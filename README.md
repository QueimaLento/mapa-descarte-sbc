# Onde Descartar SBC

Mapa estático com os pontos de descarte de **medicamentos** e **resíduos de exames de imagem**
em São Bernardo do Campo (SP). Feito para funcionar sem backend, sem banco de dados e sem
nenhuma chave de API — apenas arquivos estáticos, publicável gratuitamente no GitHub Pages.

## Como ver localmente

O mapa carrega `dados/pontos.json` via `fetch`, então não abra o `index.html` direto pelo
arquivo (`file://`). Use um servidor local:

```bash
cd mapa-descarte-sbc
python -m http.server 8000     # ou qualquer servidor estático
# abra http://localhost:8000
```

> Sem Python? Qualquer servidor estático serve (ex.: `npx serve`, VS Code "Live Server").

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub e envie esta pasta (`git init`, `git add .`, `git commit`, `git push`).
2. Em **Settings → Pages**, escolha a branch `main` e a pasta `/ (raiz)`.
3. Abra a URL gerada (algo como `https://SEUUSUARIO.github.io/mapa-descarte-sbc/`).
4. **Edite `js/config.js`** e substitua os valores com `[...]` (URL do site, repositório,
   autor, instituição, e-mail, formulário de sugestão).
5. Depois rode `node scripts/gerar_qrcode.mjs` para gerar o QR do cartaz.

O arquivo `.nojekyll` garante que o GitHub Pages publique tudo como está (sem processar com Jekyll).

## Estrutura

```
mapa-descarte-sbc/
├── index.html          mapa + lista + filtros (página principal)
├── como-descartar.html guia de descarte (medicamentos e exames)
├── sobre.html          sobre o projeto, fontes e limitações
├── cartaz.html          cartaz A4 para impressão (com QR)
├── css/estilo.css      todos os estilos (tema claro/escuro, impressão)
├── js/
│   ├── config.js       CONFIG + configDefinida() — únicos pontos de customização
│   ├── util.js         helpers (formatação, acentos, mensagens)
│   ├── tema.js         botão claro/escuro (alterna data-tema + sessionStorage)
│   └── mapa.js         Leaflet, lista, filtros, geolocalização, abas
├── dados/
│   ├── pontos.json     dados usados pelo site (fonte de verdade do front)
│   └── pontos.csv      mesma tabela em CSV (edição humana)
├── scripts/            utilitários Node (sem dependências obrigatórias)
└── img/qr-site.svg     QR gerado (opcional; há fallback em texto)
```

## Editar os dados (UBS e outros pontos)

- **Edite `dados/pontos.csv`** (separador `;`, UTF-8, 16 colunas).
- Rode `node scripts/csv_para_json.mjs --forcar` para regenerar `dados/pontos.json`.
- Rode `node scripts/validar_dados.mjs` para conferir JSON × CSV (ids únicos, status,
  resíduos, faixa de lat/lng, 16 colunas).

Campos com `-` (ex.: bairro ou CEP desconhecido) viram `null` — **nada é inventado**.
Enquanto `lat`/`lng` forem `null`, o ponto aparece na lista mas não no mapa e o botão
"Como chegar" busca o endereço no OpenStreetMap.

## Adicionar coordenadas (geocodificação)

```bash
node scripts/geocodificar.mjs                 # dry-run: só mostra as consultas
node scripts/geocodificar.mjs --executar      # consulta o Nominatim e grava lat/lng
node scripts/geocodificar.mjs --executar --limpe 5   # só os 5 primeiros
```

Consulta respeitosa ao Nominatim (1 requisição/seg, User-Agent do projeto, somente Brasil).

## Gerar o QR do cartaz

```bash
node scripts/gerar_qrcode.mjs            # só se CONFIG.URL_SITE estiver preenchida
node scripts/gerar_qrcode.mjs --forcar   # regenera
```

Sem URL configurada (valor com `[`) o script não faz nada e o cartaz mostra o texto da URL
no lugar do QR (`.qr-fallback`).

## Decisões registradas

- **Scripts em Node (`.mjs`)** em vez de Python: o ambiente de desenvolvimento não possui
  Python utilizável; Node v26+ é suficiente e não exige `npm install`.
- **19 UBS** (não 20), de Alvarenga a Pauliceia. A lista veio de terceiros
  (saobernardodocampo.info, 2026) e a regra "todas as UBS recebem medicamentos" de notícias
  locais (Repórter Diário, 30/09/2024 e 11/07/2025). Cada registro carrega `fonte` e
  `observacoes`. A lista Q–Z do portal (Planalto, Represa, Rudge Ramos, Santa Cruz…) **não**
  foi incluída: a seção 6 do pedido fixa exatamente as 19 UBS acima.
- **Geolocalização só no navegador**, sem armazenamento: filtros vivem em memória, não há
  cookies, analytics nem localStorage.
- **Único recurso externo**: Leaflet 1.9.4 (unpkg) + tiles OSM, com atribuição visível.
  Tudo o mais (fontes do sistema, ícones SVG inline, marcadores via `L.divIcon`) é local.
- **`config.js` como único ponto de customização**: qualquer valor com `[` é tratado como
  placeholder (`configDefinida`) e oculta botão/seção correspondente.
- **`fetch` de JSON** exige servidor HTTP; a mensagem de erro orienta o usuário a subir um
  servidor local em vez de duplicar os dados dentro do JS.
- **Status `a_confirmar` em todas as linhas**, com `confirmado_em` vazio: os dados vieram de
  fontes oficiais, mas nenhuma unidade foi visitada/confirada in loco pelo autor. O validador
  avisa ("coordenadas preenchidas mas status ainda a_confirmar") sem derrubar a execução
  (exit 0). O campo continua **nos dados** (CSV/JSON), mas **não é exibido na interface** —
  os selos de status foram removidos de `js/mapa.js`, `sobre.html` e do CSS.
- **Paleta clara = azul sobre branco** (`--cor-primaria: #1d4ed8`, fundo `#ffffff`,
  superfícies azul-acinzentadas); **paleta escura = verde sobre preto**
  (`--cor-primaria: #4ade80`, fundo `#000000`, superfícies `#0d130f`/`#131b16`), acessível
  (AA) nos dois temas. O `prefers-color-scheme` foi substituído por `data-tema` no `<html>`.
- **Botão de tema nas 4 páginas** (ícones sol/lua em SVG inline, alvo 44×44px). O tema inicial
  é aplicado por script inline no `<head>` (antes do CSS, sem flash); `js/tema.js` alterna e
  grava a escolha em **`sessionStorage`** (só a aba; sem `localStorage`, sem cookies — fecha a
  aba e volta ao `prefers-color-scheme` do sistema). Se `sessionStorage` estiver indisponível,
  o tema vale só na página. Registra-se em `aria-pressed`.
- **Impressão sempre no tema claro**: `@media print` força a paleta clara em qualquer tema e
  esconde cabeçalho/navegação/rodapé — o cartaz A4 sai preto/branco sobre branco mesmo com o
  site no escuro.

## Segurança (revisão de pentest)

- **Sanitização de URLs**: todo `href` montado a partir de `CONFIG` passa por
  `urlSegura()` (em `js/util.js`): aceita apenas `http(s)://`, converte e-mail simples em
  `mailto:` e joga qualquer outro valor para `"#"` — um placeholder do tipo
  `javascript:...` ou `[texto]` nunca vira destino clicável (12 call sites: `js/mapa.js`,
  `sobre.html`, `cartaz.html`, `como-descartar.html`).
- **Content-Security-Policy** em meta tag nas 4 páginas:
  `default-src 'self' file: data:; script-src 'self' file: 'unsafe-inline' https://unpkg.com; style-src 'self' file: 'unsafe-inline' https://unpkg.com; img-src 'self' file: data: https:; connect-src 'self' file:; font-src 'self' file:; object-src 'none'; base-uri 'self'; form-action 'self'`.
  - `file:` deixa o site abrir por duplo-claque (fetch do JSON degrada com aviso, como já
    documentado); em produção o GitHub Pages serve `https:` e o `file:` fica inerte.
  - `img-src https:` amplo de propósito: `CONFIG.URL_TILES` é configurável pelo usuário.
  - `'unsafe-inline'` é necessário pelos scripts inline (impressão do cartaz, QR fallback)
    e pelos `style` dos `L.divIcon`; por isso a sanitização acima é obrigatória.
  - `frame-ancestors` só funciona em header HTTP — omitido da meta (inócuo no GitHub Pages).
- **Leaflet 1.9.4 via unpkg com SRI** (hash byte a byte conferido) e `rel="noopener"` nos
  links externos; `target="_blank"` nunca aparece sem ele.
- **CSV à prova de injeção de planilha**: campos iniciados por `=`, `+`, `-` ou `@` são
  neutralizados no `scripts/csv_para_json.mjs`; separador `;` e UTF-8 com BOM.
- **Privacidade**: sem cookies, sem analytics, sem `localStorage`; o único dado guardado é a
  escolha de tema em **`sessionStorage`** (some ao fechar a aba). Geolocalização só no
  navegador, nunca enviada a servidor nenhum.

Validação executada: `node --check` em `js/util.js`/`js/mapa.js`/`js/tema.js`, grep confirmando 0
`href` cru com `CONFIG`, `validar_dados.mjs` (exit 0) e smoke test em Chrome headless
(4 páginas: 0 violações de CSP, 0 erros de JS; index com 19 marcadores e 19 itens;
botão de tema presente nas 4 páginas e alternância coerente — `data-tema`,
`aria-pressed` e `sessionStorage` —, cartaz com 1 falha de recurso esperada:
`img/qr-site.svg` ainda não gerado).

## Fontes dos dados

- **Portal da Saúde de SBC** (`portalsaude.saobernardo.sp.gov.br/portaldasaude/ubs`) —
  fonte primária de **endereço, telefone e horário** das 19 UBS, incluindo os links oficiais
  do Google Maps usados como coordenadas.
- **Prefeitura de SBC** (`saobernardo.sp.gov.br/onde-ficam-as-unidades-de-saude-ubss`) —
  **bairro** de cada unidade.
- **saobernardodocampo.info** (2026) — lista/terceira via de conferência.
- **Repórter Diário**, 30/09/2024 e 11/07/2025 — regra de que todas as UBS recebem
  medicamentos vencidos.
- **Nominatim (OpenStreetMap)** — geocodificação das 6 unidades sem link de coordenadas no
  portal, com 1 consulta/segundo e User-Agent do projeto.

## Decisões sobre os dados

- **Horários**: 7 linhas corrigidas pelo Portal da Saúde (Alves Dias 07–22, Areião 07–19,
  Demarchi 07–22, Ferrazópolis 07–22, Jordanópolis 07–19, Montanhão 07–19, Pauliceia 07–19);
  as outras 12 já conferiam.
- **Bairro da UBS Calux = "Vila Armando Bondioli"**: o link oficial do portal
  (`maps.app.goo.gl/4NsrxcMTmDi4WUkX8`) resolveu para "R. André Rosa Coppini, 121 –
  Vila Armando Bondioli – 09895-310" e as coordenadas `!3d-23.7064072!4d-46.5670515`.
- **CEP do Montanhão = 09791-250** (geocodificação): o 09892-250 do portal era cópia do link
  de Jordanópolis; ambos os CEPs estão em `observacoes`.
- **UBS Pauliceia sem bairro** (`null`): a Prefeitura não informa bairro para essa unidade —
  nada foi inventado.
- **UBS Areião** geocodificada na clínica "Antônio Natal Buonfiglio" (Rua Airton Senna, 55,
  Vila Areião, Montanhão), nome oficial registrado em `observacoes`.
- **`fonte` uniforme** nas 19 linhas (sem `;`, para não quebrar o CSV): Portal da Saúde +
  Prefeitura + lista de terceiros + regra de medicamentos.

## Licença e créditos

Mapa © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
Código do projeto: livre para uso e adaptação com fins educacionais.
