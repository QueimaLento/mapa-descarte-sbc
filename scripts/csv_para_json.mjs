#!/usr/bin/env node
/* =========================================================================
   csv_para_json.mjs — converte dados/pontos.csv em dados/pontos.json
   -------------------------------------------------------------------------
   Uso:  node scripts/csv_para_json.mjs [--forcar]
   Sem --forcar, recusa sobrescrever um pontos.json que já existe.
   Conversão:
     - colunas vazias        -> null (bairro, telefone, horario, lat, lng,
                                 confirmado_em) ou "" (observacoes);
     - residuos              -> lista separada por vírgula;
     - endereco_incompleto   -> booleano true/false;
     - lat/lng               -> número ou null;
     - metadados             -> versao 1 e atualizado_em = hoje (UTC).
   Editar o CSV e reexecutar este script atualiza o JSON usado pelo site.
   ========================================================================= */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CAMINHO_CSV = join(RAIZ, "dados", "pontos.csv");
const CAMINHO_JSON = join(RAIZ, "dados", "pontos.json");
const FORCAR = process.argv.includes("--forcar");

if (existsSync(CAMINHO_JSON) && !FORCAR) {
  console.error(`ERRO: ${CAMINHO_JSON} já existe. Reexecute com --forcar para sobrescrever.`);
  process.exit(1);
}

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

const bruto = readFileSync(CAMINHO_CSV);
const texto = bruto.toString("utf8").replace(/^\ufeff/, "");
const linhas = lerCsv(texto);
if (linhas.length < 2) {
  console.error("ERRO: CSV sem dados.");
  process.exit(1);
}

const colunas = linhas[0];
const paraNumero = (s) => (s.trim() === "" ? null : Number(s));
const paraTexto = (s) => (s.trim() === "" ? null : s);
const pontos = linhas.slice(1).map((linha, i) => {
  const obj = Object.fromEntries(colunas.map((c, j) => [c, linha[j] ?? ""]));
  const registro = {};
  registro.id = obj.id;
  registro.nome = obj.nome;
  registro.tipo = obj.tipo;
  registro.endereco = obj.endereco;
  registro.bairro = paraTexto(obj.bairro);
  registro.cidade = obj.cidade;
  registro.telefone = paraTexto(obj.telefone);
  registro.horario = paraTexto(obj.horario);
  registro.residuos = obj.residuos.split(",").map((s) => s.trim()).filter(Boolean);
  registro.lat = paraNumero(obj.lat);
  registro.lng = paraNumero(obj.lng);
  registro.status = obj.status;
  registro.confirmado_em = paraTexto(obj.confirmado_em);
  registro.fonte = obj.fonte;
  registro.observacoes = obj.observacoes || "";
  registro.endereco_incompleto = obj.endereco_incompleto === "true";
  if (!registro.id) {
    console.error(`ERRO: linha ${i + 2} sem id.`);
    process.exit(1);
  }
  return registro;
});

const hoje = new Date().toISOString().slice(0, 10);
const saida = {
  versao: 1,
  atualizado_em: hoje,
  cidade: "São Bernardo do Campo",
  pontos
};

writeFileSync(CAMINHO_JSON, JSON.stringify(saida, null, 2) + "\n", "utf8");
console.log(`OK: ${pontos.length} ponto(s) gravado(s) em ${CAMINHO_JSON} (atualizado_em=${hoje}).`);
