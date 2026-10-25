#!/usr/bin/env node
/* =========================================================================
   geocodificar.mjs — preenche lat/lng dos pontos sem coordenadas
   -------------------------------------------------------------------------
   Uso:  node scripts/geocodificar.mjs [--executar] [--limite N]
   Padrão: SÓ SIMULA (dry-run) — mostra a consulta que faria, sem rede.
   --executar  usa o Nominatim público do OpenStreetMap (1 requisição/seg,
               User-Agent identificando o projeto). Sem chave, sem custo.
   --limite N  no máximo N pontos geocodificados por execução (padrão 19).

   Consulta:  <endereco>, <bairro>, São Bernardo do Campo, SP, Brasil
   Depois de geocodificar, revise manualmente no mapa e marque os pontos
   confirmados no CSV (status=confirmado, confirmado_em=AAAA-MM-DD).

   Política do Nominatim: no máximo 1 req/s, identifique o aplicativo,
   não repita consultas em loop. Por isso este script é executado pelo
   usuário, uma vez, e não pelo site.
   ========================================================================= */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CAMINHO_JSON = join(RAIZ, "dados", "pontos.json");

const EXECUTAR = process.argv.includes("--executar");
const LIMITE = (() => {
  const i = process.argv.indexOf("--limite");
  if (i >= 0 && process.argv[i + 1]) return Number(process.argv[i + 1]);
  return 19;
})();

const USER_AGENT = "mapa-descarte-sbc/1.0 (projeto estudantil sem fins lucrativos)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

const dados = JSON.parse(readFileSync(CAMINHO_JSON, "utf8"));
const pendentes = dados.pontos.filter((p) => p.lat === null || p.lng === null);

if (pendentes.length === 0) {
  console.log("OK: nenhum ponto sem coordenadas.");
  process.exit(0);
}

console.log(`${pendentes.length} ponto(s) sem coordenadas; limite desta execução: ${LIMITE}\n`);

const alvo = pendentes.slice(0, LIMITE);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

let feitos = 0;
for (const p of alvo) {
  const partes = [p.endereco, p.bairro, p.cidade, "SP", "Brasil"].filter(Boolean);
  const consulta = partes.join(", ");
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", consulta);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");

  if (!EXECUTAR) {
    console.log(`[simular] ${p.id}\n          ${url.toString()}\n`);
    continue;
  }

  try {
    const resp = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const itens = await resp.json();
    if (!itens.length) {
      console.log(`[sem resultado] ${p.id} — ${consulta}`);
    } else {
      p.lat = Number(Number(itens[0].lat).toFixed(6));
      p.lng = Number(Number(itens[0].lon).toFixed(6));
      const onde = itens[0].display_name || "";
      console.log(`[ok] ${p.id} -> ${p.lat}, ${p.lng} (${onde.slice(0, 80)})`);
      feitos++;
    }
  } catch (e) {
    console.log(`[erro] ${p.id}: ${e.message}`);
  }
  await dormir(1100);
}

if (EXECUTAR) {
  if (feitos) {
    writeFileSync(CAMINHO_JSON, JSON.stringify(dados, null, 2) + "\n", "utf8");
    console.log(`\nOK: ${feitos} ponto(s) atualizado(s) em ${CAMINHO_JSON}.`);
    console.log("Próximo passo: rode `node scripts/validar_dados.mjs` e revise no mapa.");
  } else {
    console.log("\nNenhum ponto atualizado.");
  }
} else {
  console.log("Modo simulação (nenhuma requisição feita). Reexecute com --executar.");
}
