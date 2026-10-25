/**
 * util.js - Funções auxiliares compartilhadas pelo site.
 *
 * Aqui ficam: distância entre dois pontos, formatação de textos,
 * normalização (remoção de acentos) e recursos de acessibilidade.
 * Nada aqui guarda informação em disco: tudo existe apenas em memória.
 */

/**
 * Remove acentos, símbolos e deixa o texto em minúsculas.
 * Útil para buscar "UBS Orquideas" achando "UBS Orquídeas".
 * @param {string} texto Texto de entrada.
 * @returns {string} Texto normalizado.
 */
function normalizarTexto(texto) {
  if (texto === null || texto === undefined) return "";
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")    // remove símbolos
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converte um nome em identificador curto (slug).
 * Ex.: "UBS Baeta Neves" -> "ubs-baeta-neves".
 * @param {string} texto Texto de entrada.
 * @returns {string} Slug.
 */
function gerarSlug(texto) {
  return normalizarTexto(texto).replace(/\s+/g, "-");
}

/**
 * Distância em linha reta entre dois pontos, em metros (fórmula de Haversine).
 * Usada só para ordenar a lista quando o usuário autoriza a localização.
 * @param {number} lat1 Latitude do ponto 1.
 * @param {number} lng1 Longitude do ponto 1.
 * @param {number} lat2 Latitude do ponto 2.
 * @param {number} lng2 Longitude do ponto 2.
 * @returns {number} Distância em metros.
 */
function calcularDistanciaMetros(lat1, lng1, lat2, lng2) {
  const RAIO_TERRA = 6371000; // raio médio da Terra em metros
  const paraRad = (graus) => (graus * Math.PI) / 180;
  const dLat = paraRad(lat2 - lat1);
  const dLng = paraRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(paraRad(lat1)) * Math.cos(paraRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RAIO_TERRA * c;
}

/**
 * Formata uma distância em metros para texto amigável em português.
 * @param {number} metros Distância em metros.
 * @returns {string} Ex.: "850 m" ou "3,4 km".
 */
function formatarDistancia(metros) {
  if (!isFinite(metros)) return "";
  if (metros < 1000) return Math.round(metros) + " m";
  const km = metros / 1000;
  return km.toFixed(1).replace(".", ",") + " km";
}

/**
 * Monta uma data no formato brasileiro (dd/mm/aaaa).
 * @param {string} iso Data no formato "aaaa-mm-dd".
 * @returns {string} Data formatada ou texto vazio.
 */
function formatarData(iso) {
  if (!iso) return "";
  const partes = String(iso).split("-");
  if (partes.length !== 3) return String(iso);
  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

/**
 * Monta um link tel: limpo a partir de um telefone já formatado.
 * Ex.: "(11) 4357-4893" -> "tel:+551143574893".
 * @param {string} telefone Telefone exibido ao usuário.
 * @returns {string|null} Link tel: ou null quando não há telefone.
 */
function montarLinkTelefone(telefone) {
  if (!telefone) return null;
  const digitos = String(telefone).replace(/\D/g, "");
  if (!digitos) return null;
  const comPais = digitos.length >= 10 && digitos.length <= 11 ? "55" + digitos : digitos;
  return "tel:" + comPais;
}

/**
 * Monta um link para buscar o endereço no OpenStreetMap.
 * Útil enquanto o ponto ainda não tem coordenadas preenchidas.
 * @param {string} endereco Endereço do ponto.
 * @param {string} cidade Cidade.
 * @returns {string} URL de busca do OpenStreetMap.
 */
function montarBuscaEndereco(endereco, cidade) {
  const consulta = encodeURIComponent([endereco, cidade].filter(Boolean).join(", "));
  return "https://www.openstreetmap.org/search?query=" + consulta;
}

/**
 * Valida uma URL vinda da CONFIG antes de virar link (href).
 * Aceita apenas http:// ou https://; um e-mail simples vira mailto:.
 * Qualquer outro esquema (ex.: javascript:) vira "#", sem executar código.
 * @param {string} valor Texto vindo da CONFIG.
 * @returns {string} URL segura ou "#" quando o valor não é seguro.
 */
function urlSegura(valor) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (/^https?:\/\/[^\s"'<>]+$/i.test(texto)) return texto;
  if (/^[^\s"'<>@,;:]+@[^\s"'<>@,;:]+\.[^\s"'<>@,;:]+$/.test(texto)) {
    return "mailto:" + texto;
  }
  return "#";
}

/**
 * Cria um elemento HTML com texto seguro (sem risco de injeção de código).
 * Nunca use innerHTML com dados vindos do pontos.json.
 * @param {string} tag Nome da tag, ex.: "li".
 * @param {string} classe Classes CSS.
 * @param {string} texto Conteúdo em texto puro.
 * @returns {HTMLElement} Elemento criado.
 */
function criarElementoTexto(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  el.textContent = texto === null || texto === undefined ? "" : String(texto);
  return el;
}

/**
 * Anuncia uma mensagem para leitores de tela (região aria-live).
 * @param {string} mensagem Mensagem a ser anunciada.
 */
function anunciar(mensagem) {
  const regiao = document.getElementById("anuncios");
  if (!regiao) return;
  // Limpa antes de escrever para o leitor de tela reler a nova mensagem.
  regiao.textContent = "";
  window.setTimeout(function () {
    regiao.textContent = mensagem;
  }, 50);
}

/**
 * Remove filhos de um elemento (para redesenhar a lista).
 * @param {HTMLElement} elemento Elemento alvo.
 */
function limparFilhos(elemento) {
  while (elemento.firstChild) {
    elemento.removeChild(elemento.firstChild);
  }
}

/**
 * Aplica configurações opcionais em um trecho da página.
 * Se o valor não estiver preenchido (contém "["), o trecho inteiro some.
 * @param {string} idSeletor Id do elemento a ocultar.
 * @param {string} valor Valor vindo da CONFIG.
 */
function aplicarConfiguracaoOpcional(idSeletor, valor) {
  const alvo = document.getElementById(idSeletor);
  if (!alvo) return;
  if (!configDefinida(valor)) {
    alvo.setAttribute("hidden", "hidden");
  }
}
