#!/usr/bin/env node
/**
 * Gera img/qr-site.svg a partir de CONFIG.URL_SITE (js/config.js).
 *
 * Regras:
 * - Valor com "[" é placeholder: NÃO gera QR, apenas avisa e sai (exit 0).
 * - Tenta usar o pacote npm "qrcode" (instalado localmente ou via npx em cache temporário).
 * - Nunca modifica arquivos do site além de img/qr-site.svg.
 *
 * Uso:
 *   node scripts/gerar_qrcode.mjs            gera o QR se a URL estiver configurada
 *   node scripts/gerar_qrcode.mjs --forcar   sobrescreve img/qr-site.svg existente
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const caminhoConfig = path.join(raiz, "js", "config.js");
const caminhoSaida = path.join(raiz, "img", "qr-site.svg");
const forcar = process.argv.includes("--forcar");

if (!existsSync(caminhoConfig)) {
  console.error(`ERRO: não encontrei ${caminhoConfig}`);
  process.exit(1);
}

const fonte = readFileSync(caminhoConfig, "utf8");
const m = fonte.match(/URL_SITE\s*:\s*"([^"]*)"/);
if (!m) {
  console.error('ERRO: não encontrei CONFIG.URL_SITE em js/config.js');
  process.exit(1);
}
const url = m[1].trim();

if (!url || url.includes("[")) {
  console.log(
    "AVISO: CONFIG.URL_SITE ainda é placeholder. QR não gerado.\n" +
      "       Edite js/config.js com a URL publicada (ex.: https://SEUUSUARIO.github.io/mapa-descarte-sbc/)\n" +
      "       e rode novamente: node scripts/gerar_qrcode.mjs"
  );
  process.exit(0);
}

if (!/^https?:\/\//i.test(url)) {
  console.error(`ERRO: CONFIG.URL_SITE deve começar com http(s):// — valor atual: ${url}`);
  process.exit(1);
}

if (existsSync(caminhoSaida) && !forcar) {
  console.log(`OK: ${path.relative(raiz, caminhoSaida)} já existe. Use --forcar para regenerar.`);
  process.exit(0);
}

mkdirSync(path.dirname(caminhoSaida), { recursive: true });

async function carregarQrcode() {
  try {
    return await import("qrcode");
  } catch {
    return null;
  }
}

const qrcode = await carregarQrcode();

if (qrcode && typeof qrcode.toString === "function") {
  const svg = await qrcode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  writeFileSync(caminhoSaida, svg, "utf8");
  console.log(`OK: ${path.relative(raiz, caminhoSaida)} gerado (pacote "qrcode").`);
  process.exit(0);
}

console.log("Pacote 'qrcode' indisponível localmente; tentando npx (instalação em cache temporário)...");
const r = spawnSync(
  "npx",
  ["--yes", "qrcode", "-t", "svg", "-o", caminhoSaida, url],
  { stdio: "inherit", shell: process.platform === "win32" }
);

if (r.status === 0 && existsSync(caminhoSaida)) {
  console.log(`OK: ${path.relative(raiz, caminhoSaida)} gerado (npx qrcode).`);
  process.exit(0);
}

console.error(
  "ERRO: não foi possível gerar o QR.\n" +
    "  Alternativas: npm install qrcode --no-save && node scripts/gerar_qrcode.mjs\n" +
    "  Ou mantenha o fallback de texto do cartaz (.qr-fallback) — o site funciona sem o QR."
);
process.exit(1);
