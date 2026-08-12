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

function readConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
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

function getUltimoNsu(cfg, empresaIndex) {
  const empresa = cfg.empresas[empresaIndex];
  const salvo = readUltimoNsu(empresaIndex);
  if (salvo != null) return salvo;
  if (empresa.ultimoNsu != null) return empresa.ultimoNsu;
  return 0;
}

function enviarXml(endpoint, segredo, xml) {
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
        },
        timeout: 60000,
      },
      (res) => {
        let chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, body: text });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 300)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout ao enviar XML para o endpoint"));
    });
    req.write(body);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processarEmpresa(cfg, empresaIndex, modoTeste) {
  const empresa = cfg.empresas[empresaIndex];
  log(`Iniciando consulta para ${empresa.nome} (${empresa.cnpj})`);

  if (!fs.existsSync(empresa.caminhoCertificado)) {
    throw new Error(`Certificado nao encontrado: ${empresa.caminhoCertificado}`);
  }

  const client = new SefazCteClient(empresa, cfg.ambiente);
  let ultimoNsu = getUltimoNsu(cfg, empresaIndex);
  let totalEnviados = 0;
  let totalCiclos = 0;

  // A SEFAZ retorna no máximo 50 documentos por consulta. Continua até não haver mais documentos.
  while (totalCiclos < 20) {
    totalCiclos++;
    log(`Consultando NSU ${ultimoNsu} (ciclo ${totalCiclos})`);
    const { xmls, maxNsu, cStat, xMotivo } = await client.consultar(ultimoNsu);
    log(`Retorno: cStat=${cStat}, maxNSU=${maxNsu}, documentos=${xmls.length}, motivo=${xMotivo || "ok"}`);

    if (!xmls.length) {
      ultimoNsu = maxNsu;
      break;
    }

    const ctes = filtrarProcCte(xmls.map((x) => ({ ...x, xml: extrairXmlProcCte(x.xml) })));
    log(`CT-e filtrados: ${ctes.length}`);

    for (const cte of ctes) {
      try {
        if (modoTeste) {
          log(`[TESTE] XML encontrado (NSU ${cte.nsu}) - nao enviado`);
          continue;
        }
        const result = await enviarXml(cfg.endpoint, cfg.segredoIngest, cte.xml);
        const body = JSON.parse(result.body || "{}");
        log(`Enviado NSU ${cte.nsu} -> status=${body.status || "-"}, duplicado=${body.duplicated || false}`);
        totalEnviados++;
      } catch (e) {
        log(`Erro ao enviar NSU ${cte.nsu}: ${e.message}`);
        if (!modoTeste) throw e; // para de tentar se o envio falhar
      }
    }

    ultimoNsu = maxNsu;
    writeUltimoNsu(empresaIndex, ultimoNsu);

    // Se o maxNSU não avançou, não há mais documentos
    if (maxNsu <= ultimoNsu && ctes.length === 0) break;
    await sleep(500); // pequena pausa entre consultas para não atingir limites
  }

  log(`Finalizado ${empresa.nome}: ${totalEnviados} CT-e enviados, NSU=${ultimoNsu}`);
}

async function run() {
  const modoTeste = process.argv.includes("--modo-teste");
  const umaVez = process.argv.includes("--uma-vez") || modoTeste;
  log(`Robo iniciado. Modo teste=${modoTeste}, uma vez=${umaVez}`);

  do {
    try {
      const cfg = readConfig();
      if (!cfg.empresas || !cfg.empresas.length) {
        log("Nenhuma empresa configurada. Encerrando.");
        break;
      }
      for (let i = 0; i < cfg.empresas.length; i++) {
        await processarEmpresa(cfg, i, modoTeste);
        await sleep(1000);
      }
    } catch (e) {
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
