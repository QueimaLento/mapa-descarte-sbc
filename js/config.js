/**
 * config.js - Constantes editáveis do site "Onde Descartar SBC".
 *
 * Este é o único arquivo que você precisa editar para personalizar o site.
 * Depois de alterar, basta salvar e publicar (o GitHub Pages atualiza sozinho).
 *
 * REGRA IMPORTANTE: qualquer valor que ainda contenha "[" (colchete) é
 * tratado como "ainda não configurado". Nesses casos a interface oculta
 * automaticamente o botão ou trecho correspondente, sem quebrar a página.
 * Assim você pode publicar antes de ter o e-mail, o link do formulário etc.
 */
const CONFIG = {
  // Nome e subtítulo usados no cabeçalho, no rodapé e no título das abas.
  NOME_PROJETO: "Onde Descartar SBC",
  CIDADE: "São Bernardo do Campo",

  // Centro do mapa: latitude e longitude de São Bernardo do Campo (SP).
  CENTRO_MAPA: [-23.6914, -46.5646],

  // Zoom inicial do mapa (11 = cidade inteira, 19 = nível de rua).
  ZOOM_INICIAL: 12,

  // Provedor dos tiles (máquadas) do mapa.
  // Se o OpenStreetMap bloquear o acesso, troque aqui por outro provedor
  // que aceite o mesmo padrão {z}/{x}/{y} e mantenha a atribuição correta.
  URL_TILES: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

  // Texto de atribuição obrigatório do OpenStreetMap (não remova).
  ATRIBUICAO: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',

  // Link do formulário de sugestão de novos pontos (Google Forms, gratuito).
  URL_FORM_SUGESTAO: "[COLE AQUI O LINK DO GOOGLE FORMS DE SUGESTÃO]",

  // E-mail de contato do projeto (usado apenas se você preencher).
  EMAIL_CONTATO: "[SEU E-MAIL]",

  // Identificação do responsável (aparece no rodapé e na página Sobre).
  AUTOR: "[SEU NOME]",
  INSTITUICAO: "[SUA FACULDADE]",
  CURSO: "Ciência da Computação",

  // Endereço público do site (usado no cartaz e no QR Code).
  URL_SITE: "https://queimalento.github.io/mapa-descarte-sbc/",

  // Link do repositório público no GitHub.
  URL_REPOSITORIO: "https://github.com/QueimaLento/mapa-descarte-sbc"
};

/**
 * Informa se um valor de configuração já foi preenchido.
 * @param {string} valor - Texto vindo da CONFIG.
 * @returns {boolean} true quando o texto existe e não contém "[".
 */
function configDefinida(valor) {
  return typeof valor === "string" && valor.trim() !== "" && valor.indexOf("[") === -1;
}
