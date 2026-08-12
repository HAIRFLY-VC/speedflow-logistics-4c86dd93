// Cliente do webservice CTeDistribuicaoDFe da SEFAZ (Ambiente Nacional).
// Usa mTLS com certificado A1 (.pfx) e descompacta os documentos retornados.

import https from "https";
import zlib from "zlib";
import { readFileSync } from "fs";

const URLS = {
  producao: "https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx",
  homologacao: "https://hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx",
};

const SOAP_ACTION = "http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe/cteDistDFeInteresse";

function buildEnvelope(cnpj, ufAutor, ultimoNsu, ambiente) {
  const nsu = String(ultimoNsu).padStart(15, "0");
  const tpAmb = ambiente === "homologacao" ? "2" : "1";
  const uf = String(ufAutor || 35).padStart(2, "0");
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <cteDadosMsg xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe">
      <distDFeInt xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00">
        <tpAmb>${tpAmb}</tpAmb>
        <cUFAutor>${uf}</cUFAutor>
        <CNPJ>${cnpj}</CNPJ>
        <distNSU>
          <ultNSU>${nsu}</ultNSU>
        </distNSU>
      </distDFeInt>
    </cteDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}


function postXml(url, xml, agent) {
  return new Promise((resolve, reject) => {
    const reqUrl = new URL(url);
    const req = https.request(
      {
        method: "POST",
        hostname: reqUrl.hostname,
        path: reqUrl.pathname,
        port: 443,
        headers: {
          // SOAP 1.2: a acao vai como parametro do Content-Type (nao existe header SOAPAction).
          "Content-Type": `application/soap+xml; charset=utf-8; action="${SOAP_ACTION}"`,
          "Content-Length": Buffer.byteLength(xml),
        },

        agent,
        timeout: 60000,
      },
      (res) => {
        let chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}: ${buffer.toString("utf-8").slice(0, 500)}`));
          }
          resolve(buffer.toString("utf-8"));
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout na requisição SEFAZ"));
    });
    req.write(xml);
    req.end();
  });
}

function extractText(xml, tag) {
  const re = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function extractAll(xml, tag) {
  const re = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "gi");
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

// Extrai os nos <docZip NSU="..." schema="...">base64</docZip> com seus atributos.
function extractDocZips(xml) {
  const re = /<(?:\w+:)?docZip([^>]*)>([\s\S]*?)<\/(?:\w+:)?docZip>/gi;
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1] || "";
    const nsu = /NSU\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] || "0";
    const schema = /schema\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] || "";
    out.push({ nsu, schema, base64: (m[2] || "").trim() });
  }
  return out;
}

function extractSoapFault(xml) {
  if (!/<(?:\w+:)?Fault[\s>]/i.test(xml)) return null;
  const motivo =
    extractText(xml, "faultstring") ||
    extractText(xml, "Text") ||
    extractText(xml, "Reason") ||
    "erro SOAP nao identificado";
  return motivo.replace(/<[^>]+>/g, "").trim();
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export class SefazCteClient {
  constructor(empresa, ambiente) {
    this.empresa = empresa;
    this.ambiente = ambiente || "producao";
    this.url = URLS[this.ambiente] || URLS.producao;
    const pfx = readFileSync(empresa.caminhoCertificado);
    this.agent = new https.Agent({
      pfx,
      passphrase: empresa.senhaCertificado,
      rejectUnauthorized: true,
    });
  }

  async consultar(ultimoNsu) {
    const envelope = buildEnvelope(this.empresa.cnpj, this.empresa.ufAutor, ultimoNsu, this.ambiente);
    const response = await postXml(this.url, envelope, this.agent);

    const fault = extractSoapFault(response);
    if (fault) throw new Error(`SEFAZ recusou a requisicao (SOAP Fault): ${fault}`);

    const cteDistDFeInteresseResult = decodeEntities(
      extractText(response, "cteDistDFeInteresseResult") || response
    );


    // Verifica cStat de retorno
    const cStat = extractText(cteDistDFeInteresseResult, "cStat");
    const xMotivo = extractText(cteDistDFeInteresseResult, "xMotivo") || "";
    if (cStat && cStat !== "138") {
      if (cStat === "137" || cStat === "656") {
        // Sem documentos para o CNPJ consultado ou nenhum documento encontrado
        return { xmls: [], maxNsu: ultimoNsu, cStat, xMotivo };
      }
      throw new Error(`SEFAZ retornou cStat=${cStat}: ${xMotivo}`);
    }

    const maxNsu = parseInt(extractText(cteDistDFeInteresseResult, "maxNSU") || String(ultimoNsu), 10);
    const docs = extractDocZips(cteDistDFeInteresseResult);

    const xmls = [];
    for (const doc of docs) {
      if (!doc.base64) continue;
      try {
        const compressed = Buffer.from(doc.base64, "base64");
        const xmlDoc = zlib.gunzipSync(compressed).toString("utf-8");
        xmls.push({ nsu: parseInt(doc.nsu, 10) || 0, schema: doc.schema, xml: xmlDoc });
      } catch (e) {
        // ignora documentos que não conseguir descompactar
      }
    }


    return { xmls, maxNsu, cStat, xMotivo };
  }
}

export function filtrarProcCte(xmls) {
  return xmls.filter((item) => {
    const schema = item.schema.toLowerCase();
    const xml = item.xml.toLowerCase();
    return schema.includes("procte") || xml.includes("<procte") || xml.includes("procte>");
  });
}

export function extrairXmlProcCte(xml) {
  // Se o conteúdo já é um procCTe, retorna normalizado.
  // Alguns documentos podem vir embrulhados em outros nós; tenta desembrulhar.
  const match = xml.match(/<\?xml[^?]*\?>/i);
  if (!match) return xml;
  return xml;
}
