#!/usr/bin/env node
/* =========================================================================
   validar_dados.mjs — confere dados/pontos.json e dados/pontos.csv
   -------------------------------------------------------------------------
   Uso:  node scripts/validar_dados.mjs
   Sai com código 1 se houver qualquer erro; 0 se tudo estiver consistente.
   Verifica:
     - JSON válido, com "pontos" não vazio;
     - campos obrigatórios e tipos de cada ponto;
     - id minúsculo, com hífens, único;
     - status entre os valores permitidos;
     - residuos válidos (medicamentos, exames);
     - lat/lng juntos ou ausentes, dentro da faixa válida;
     - CSV: separador ";", aspas corretas, 16 colunas por linha;
     - cada linha do CSV corresponde a um ponto do JSON, campo a campo.
   ========================================================================= */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CAMINHO_JSON = join(RAIZ, "dados", "pontos.json");
const CAMINHO_CSV = join(RAIZ, "dados", "pontos.csv");

const STATUS_VALIDOS = new Set(["confirmado", "a_confirmar", "desatualizado", "inativo"]);
const RESIDUOS_VALIDOS = new Set(["medicamentos", "exames"]);
const CAMPOS_OBRIGATORIOS = ["id", "nome", "tipo", "endereco", "cidade", "residuos", "status"];
const COLUNAS = [
  "id", "nome", "tipo", "endereco", "bairro", "cidade", "telefone", "horario",
  "residuos", "lat", "lng", "status", "confirmado_em", "fonte", "observacoes",
  "endereco_incompleto"
];

const erros = [];
const avisos = [];
const erro = (m) => erros.push(m);
const aviso = (m) => avisos.push(m);

/* ------------------------------ CSV parser ------------------------------ */
function lerCsv(texto) {
  const linhas = [];
  let campo = "", linha = [], dentroDeAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else dentroDeAspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"' && campo === "") { dentroDeAspas = true; continue; }
    if (c === ";") { linha.push(campo); campo = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; continue; }
    campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  if (dentroDeAspas) throw new Error("CSV: aspas abertas e nunca fechadas.");
  return linhas;
}

const vazio = (s) => s === undefined || s === null || String(s).trim() === "";

/* ------------------------------- JSON ---------------------------------- */
let dados;
try {
  dados = JSON.parse(readFileSync(CAMINHO_JSON, "utf8"));
} catch (e) {
  erro(`pontos.json ilegível: ${e.message}`);
}

if (dados) {
  if (!Array.isArray(dados.pontos) || dados.pontos.length === 0) {
    erro('pontos.json: "pontos" deve ser uma lista não vazia.');
  } else {
    const ids = new Set();
    dados.pontos.forEach((p, i) => {
      const onde = `pontos[${i}] (${p.id ?? "?"})`;
      for (const campo of CAMPOS_OBRIGATORIOS) {
        if (vazio(p[campo])) erro(`${onde}: campo obrigatório vazio: ${campo}`);
      }
      if (p.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) {
        erro(`${onde}: id deve ser minúsculo com hífens: "${p.id}"`);
      }
      if (p.id) {
        if (ids.has(p.id)) erro(`${onde}: id duplicado`);
        ids.add(p.id);
      }
      if (p.status && !STATUS_VALIDOS.has(p.status)) {
        erro(`${onde}: status inválido "${p.status}"`);
      }
      if (p.status === "confirmado" && vazio(p.confirmado_em)) {
        erro(`${onde}: status confirmado exige confirmado_em`);
      }
      if (Array.isArray(p.residuos)) {
        for (const r of p.residuos) {
          if (!RESIDUOS_VALIDOS.has(r)) erro(`${onde}: resíduo inválido "${r}"`);
        }
      } else {
        erro(`${onde}: residuos deve ser lista`);
      }
      const temLat = p.lat !== null && p.lat !== undefined;
      const temLng = p.lng !== null && p.lng !== undefined;
      if (temLat !== temLng) erro(`${onde}: lat e lng precisam juntos`);
      if (temLat && (typeof p.lat !== "number" || p.lat < -90 || p.lat > 90)) {
        erro(`${onde}: lat fora da faixa: ${p.lat}`);
      }
      if (temLng && (typeof p.lng !== "number" || p.lng < -180 || p.lng > 180)) {
        erro(`${onde}: lng fora da faixa: ${p.lng}`);
      }
      if (p.cidade !== "São Bernardo do Campo") {
        aviso(`${onde}: cidade diferente da esperada: "${p.cidade}"`);
      }
      if (vazio(p.bairro) && p.bairro !== null) aviso(`${onde}: bairro deve ser null quando vazio`);
      if (temLat && p.bairro === null) aviso(`${onde}: geocodificado sem bairro preenchido`);
      if (!vazio(p.lat) && p.status === "a_confirmar") {
        aviso(`${onde}: coordenadas preenchidas mas status ainda a_confirmar`);
      }
    });
    const semCoord = dados.pontos.filter((p) => p.lat === null).length;
    if (semCoord) aviso(`${semCoord} ponto(s) ainda sem coordenadas (lat/lng nulos).`);
  }
}

/* ------------------------------- CSV ------------------------------------ */
let linhasCsv = [];
try {
  const bruto = readFileSync(CAMINHO_CSV);
  const temBom = bruto[0] === 0xef && bruto[1] === 0xbb && bruto[2] === 0xbf;
  if (!temBom) aviso("pontos.csv: sem BOM UTF-8 (recomendado para Excel).");
  linhasCsv = lerCsv(bruto.toString("utf8").replace(/^\ufeff/, ""));
} catch (e) {
  erro(`pontos.csv ilegível: ${e.message}`);
}

if (linhasCsv.length) {
  const cabecalho = linhasCsv[0];
  if (cabecalho.join(";") !== COLUNAS.join(";")) {
    erro(`CSV: cabeçalho difere do esperado.\n  obtido:   ${cabecalho.join(";")}\n  esperado: ${COLUNAS.join(";")}`);
  }
  const idsCsv = new Set();
  linhasCsv.slice(1).forEach((linha, i) => {
    const n = i + 2;
    if (linha.length !== COLUNAS.length) {
      erro(`CSV linha ${n}: ${linha.length} colunas (esperado ${COLUNAS.length}).`);
    }
    const id = linha[0];
    if (idsCsv.has(id)) erro(`CSV linha ${n}: id duplicado "${id}"`);
    idsCsv.add(id);
  });

  if (dados && Array.isArray(dados.pontos)) {
    if (dados.pontos.length !== linhasCsv.length - 1) {
      erro(`JSON tem ${dados.pontos.length} pontos; CSV tem ${linhasCsv.length - 1}.`);
    }
    const porId = new Map(dados.pontos.map((p) => [p.id, p]));
    const paraTexto = (v) => v === null || v === undefined ? "" : Array.isArray(v) ? v.join(",") : String(v);
    linhasCsv.slice(1).forEach((linha, i) => {
      const n = i + 2;
      const obj = Object.fromEntries(COLUNAS.map((c, j) => [c, linha[j] ?? ""]));
      const p = porId.get(obj.id);
      if (!p) { erro(`CSV linha ${n}: id "${obj.id}" não existe no JSON.`); return; }
      for (const c of COLUNAS) {
        if (c === "endereco_incompleto") {
          const esperado = String(Boolean(p[c]));
          if (obj[c] !== esperado) erro(`CSV linha ${n}: ${c} "${obj[c]}" != JSON ${esperado}`);
          continue;
        }
        if (c === "lat" || c === "lng") {
          const esperado = p[c] === null ? "" : String(p[c]);
          if (obj[c] !== esperado) erro(`CSV linha ${n}: ${c} "${obj[c]}" != JSON "${esperado}"`);
          continue;
        }
        if (obj[c] !== paraTexto(p[c])) {
          erro(`CSV linha ${n}: coluna ${c} difere do JSON.\n    CSV:  ${obj[c]}\n    JSON: ${paraTexto(p[c])}`);
        }
      }
    });
    for (const id of porId.keys()) {
      if (!idsCsv.has(id)) erro(`JSON: id "${id}" ausente no CSV.`);
    }
  }
}

/* ------------------------------ Resultado -------------------------------- */
for (const a of avisos) console.log(`AVISO  ${a}`);
for (const e of erros) console.log(`ERRO   ${e}`);

if (erros.length) {
  console.log(`\nFALHA: ${erros.length} erro(s), ${avisos.length} aviso(s).`);
  process.exit(1);
}
const total = dados?.pontos?.length ?? 0;
console.log(`OK: ${total} ponto(s) validado(s) em JSON e CSV; ${avisos.length} aviso(s).`);
