import fs from "fs";
import path from "path";
import https from "https";
import { SefazCteClient, filtrarProcCte, extrairXmlProcCte } from "./sefaz.js";

const CONFIG_PATH = process.env.ROBO_CTE_CONFIG || "./config.json";
const NSU_FILE = "./.ultimo-nsu";

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    const cfg = readConfig();
    const logDir = path.dirname(cfg.log?.caminho || "./logs/robo-cte.log");
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(cfg.log?.caminho || "./logs/robo-cte.log", line + "\n");
  } catch {
    // falha silenciosa no log em arquivo
  }
}

class ConfigError extends Error {}

function readConfig() {
  let raw;
  try {
    raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  } catch {
    throw new ConfigError(
      `Nao foi possivel ler o arquivo de configuracao "${CONFIG_PATH}". Crie-o a partir de config.exemplo.json.`
    );
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    const pos = /position (\d+)/.exec(e.message);
    let local = "";
    if (pos) {
      const idx = Number(pos[1]);
      const antes = raw.slice(0, idx);
      const linha = antes.split("\n").length;
      const coluna = idx - antes.lastIndexOf("\n");
      local = ` (linha ${linha}, coluna ${coluna})`;
    }
    throw new ConfigError(
      `O arquivo "${CONFIG_PATH}" nao e um JSON valido${local}: ${e.message}. ` +
        `Dica: em caminhos do Windows use barra normal ("C:/certs/certificado.pfx") ou barra invertida dupla ("C:\\\\certs\\\\certificado.pfx").`
    );
  }
}

function validarConfig(cfg) {
  const faltando = [];
  if (!cfg.endpoint) faltando.push("endpoint");
  if (!cfg.segredoIngest || cfg.segredoIngest.startsWith("COLAR_AQUI"))
    faltando.push("segredoIngest");
  if (!Array.isArray(cfg.empresas) || cfg.empresas.length === 0) {
    faltando.push("empresas");
  } else {
    cfg.empresas.forEach((e, i) => {
      if (!e.cnpj) faltando.push(`empresas[${i}].cnpj`);
      if (!e.ufAutor) faltando.push(`empresas[${i}].ufAutor`);
      if (!e.caminhoCertificado) faltando.push(`empresas[${i}].caminhoCertificado`);
      if (!e.senhaCertificado || e.senhaCertificado === "SENHA_DO_CERTIFICADO")
        faltando.push(`empresas[${i}].senhaCertificado`);
    });
  }
  if (faltando.length) {
    throw new ConfigError(
      `Configuracao incompleta em "${CONFIG_PATH}". Preencha: ${faltando.join(", ")}.`
    );
  }
}


function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

function readUltimoNsu(empresaIndex) {
  try {
    if (!fs.existsSync(NSU_FILE)) return null;
    const map = JSON.parse(fs.readFileSync(NSU_FILE, "utf-8"));
    return map[empresaIndex] ?? null;
  } catch {
    return null;
  }
}

function writeUltimoNsu(empresaIndex, nsu) {
  try {
    let map = {};
    if (fs.existsSync(NSU_FILE)) map = JSON.parse(fs.readFileSync(NSU_FILE, "utf-8"));
    map[empresaIndex] = nsu;
    fs.writeFileSync(NSU_FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch (e) {
    log(`Erro ao gravar ultimo NSU: ${e.message}`);
  }
}

let nsuOrigem = "estado";

function getUltimoNsu(cfg, empresaIndex) {
  const empresa = cfg.empresas[empresaIndex];
  // --nsu=N forca o inicio da leitura a partir do NSU informado (ex.: --nsu=0 reprocessa tudo).
  const arg = process.argv.find((a) => a.startsWith("--nsu="));
  if (arg) {
    const n = parseInt(arg.split("=")[1], 10);
    if (!Number.isNaN(n)) {
      nsuOrigem = "argumento --nsu";
      return n;
    }
  }
  const salvo = readUltimoNsu(empresaIndex);
  if (salvo != null) {
    nsuOrigem = "estado.json";
    return salvo;
  }
  if (empresa.ultimoNsu != null) {
    nsuOrigem = "config.json";
    return empresa.ultimoNsu;
  }
  nsuOrigem = "inicio";
  return 0;
}

function enviarXmlUmaVez(endpoint, segredo, xml, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const body = Buffer.from(xml, "utf-8");
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname + url.search,
        port: url.port || 443,
        headers: {
          "x-ingest-secret": segredo,
          "Content-Type": "application/xml",
          "Content-Length": body.length,
          Connection: "close",
        },
        agent: false,
        timeout: timeoutMs || 60000,
      },
      (res) => {
        let chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, body: text });
          } else {
            const err = new Error(`HTTP ${res.statusCode}: ${text.slice(0, 300)}`);
            err.retryavel = res.statusCode >= 500 || res.statusCode === 429;
            reject(err);
          }
        });
      }
    );
    req.on("error", (e) => {
      e.retryavel = true; // ECONNRESET, ETIMEDOUT, EPIPE, etc.
      reject(e);
    });
    req.on("timeout", () => {
      req.destroy();
      const err = new Error("Timeout ao enviar XML para o endpoint");
      err.retryavel = true;
      reject(err);
    });
    req.write(body);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function enviarXml(endpoint, segredo, xml, opts = {}) {
  const tentativas = Math.max(1, opts.retentativas || 3);
  let ultimoErro;
  for (let i = 1; i <= tentativas; i++) {
    try {
      return await enviarXmlUmaVez(endpoint, segredo, xml, opts.timeoutMs);
    } catch (e) {
      ultimoErro = e;
      if (!e.retryavel || i === tentativas) break;
      const espera = 1000 * Math.pow(2, i - 1);
      log(`Falha no envio (tentativa ${i}/${tentativas}): ${e.message}. Nova tentativa em ${espera}ms`);
      await sleep(espera);
    }
  }
  throw ultimoErro;
}



async function processarEmpresa(cfg, empresaIndex, modoTeste) {
  const empresa = cfg.empresas[empresaIndex];
  log(`Iniciando consulta para ${empresa.nome} (${empresa.cnpj})`);

  if (!fs.existsSync(empresa.caminhoCertificado)) {
    throw new Error(`Certificado nao encontrado: ${empresa.caminhoCertificado}`);
  }

  const client = new SefazCteClient(empresa, cfg.ambiente);
  let ultimoNsu = getUltimoNsu(cfg, empresaIndex);
  log(`NSU inicial=${ultimoNsu} (origem: ${nsuOrigem})`);
  let totalEnviados = 0;
  let totalCiclos = 0;

  // A SEFAZ retorna no máximo 50 documentos por consulta. Continua até não haver mais documentos.
  while (totalCiclos < 200) {
    totalCiclos++;
    log(`Consultando NSU ${ultimoNsu} (ciclo ${totalCiclos})`);
    const { xmls, maxNsu, ultNsu, cStat, xMotivo } = await client.consultar(ultimoNsu);
    log(`Retorno: cStat=${cStat}, ultNSU=${ultNsu}, maxNSU=${maxNsu}, documentos=${xmls.length}, motivo=${xMotivo || "ok"}`);

    if (!xmls.length) {
      ultimoNsu = maxNsu;
      break;
    }

    if (xmls.length) {
      const porSchema = {};
      for (const x of xmls) {
        const k = (x.schema || "sem-schema").split("_")[0];
        porSchema[k] = (porSchema[k] || 0) + 1;
      }
      log(`Tipos recebidos: ${Object.entries(porSchema).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    }
    const ctes = filtrarProcCte(xmls.map((x) => ({ ...x, xml: extrairXmlProcCte(x.xml) })));
    log(`CT-e filtrados: ${ctes.length}`);

    for (const cte of ctes) {
      try {
        if (modoTeste) {
          log(`[TESTE] XML encontrado (NSU ${cte.nsu}) - nao enviado`);
          continue;
        }
        const result = await enviarXml(cfg.endpoint, cfg.segredoIngest, cte.xml, {
          retentativas: cfg.retentativas || 3,
          timeoutMs: cfg.timeoutMs || 60000,
        });
        await sleep(300); // pequena pausa entre envios para nao saturar o endpoint
        const body = JSON.parse(result.body || "{}");
        log(`Enviado NSU ${cte.nsu} -> status=${body.status || "-"}, duplicado=${body.duplicated || false}`);
        totalEnviados++;
      } catch (e) {
        log(`Erro ao enviar NSU ${cte.nsu}: ${e.message}`);
        if (!modoTeste) throw e; // para de tentar se o envio falhar
      }
    }

    // Avanca apenas ate o ultimo NSU efetivamente lido (nunca pula direto para maxNSU).
    const proximoNsu = Math.max(ultNsu || 0, ...xmls.map((x) => x.nsu || 0), ultimoNsu);
    const avancou = proximoNsu > ultimoNsu;
    ultimoNsu = proximoNsu;
    if (!modoTeste) writeUltimoNsu(empresaIndex, ultimoNsu);

    if (!avancou || ultimoNsu >= maxNsu) break;
    await sleep(500); // pequena pausa entre consultas para não atingir limites
  }

  log(`Finalizado ${empresa.nome}: ${totalEnviados} CT-e enviados, NSU=${ultimoNsu}`);
}

async function run() {
  const modoTeste = process.argv.includes("--modo-teste");
  const umaVez = process.argv.includes("--uma-vez") || modoTeste;
  log(`Robo iniciado. Modo teste=${modoTeste}, uma vez=${umaVez}`);

  // Falha de configuracao e fatal: nao adianta repetir o ciclo.
  try {
    validarConfig(readConfig());
  } catch (e) {
    if (e instanceof ConfigError) {
      log(`ERRO DE CONFIGURACAO: ${e.message}`);
      process.exitCode = 1;
      log("Robo finalizado.");
      return;
    }
    throw e;
  }

  do {
    try {
      const cfg = readConfig();
      for (let i = 0; i < cfg.empresas.length; i++) {
        await processarEmpresa(cfg, i, modoTeste);
        await sleep(1000);
      }
    } catch (e) {
      if (e instanceof ConfigError) {
        log(`ERRO DE CONFIGURACAO: ${e.message}`);
        process.exitCode = 1;
        break;
      }
      log(`Erro no ciclo: ${e.message}`);
      if (umaVez) break;
    }
    if (umaVez) break;
    const cfg = readConfig();
    const intervalo = (cfg.intervaloMinutos || 30) * 60 * 1000;
    log(`Aguardando ${cfg.intervaloMinutos || 30} minutos para proximo ciclo`);
    await sleep(intervalo);
  } while (true);


  log("Robo finalizado.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
