/* =========================================================================
   tema.js - Botão de alternância de tema (claro/escuro)
   -------------------------------------------------------------------------
   - O tema inicial é aplicado por um script inline no <head> (antes do CSS),
     para evitar "flash" de cor. Aqui só alternamos quando o usuário clica.
   - Escolha gravada em sessionStorage (só nesta aba; sem cookies, sem
     localStorage). Se não houver escolha, vale prefers-color-scheme.
   ========================================================================= */
(function () {
  "use strict";

  var botao = document.getElementById("botao-tema");
  if (!botao) return;

  function temaAtual() {
    return document.documentElement.getAttribute("data-tema") === "escuro"
      ? "escuro"
      : "claro";
  }

  function refletir(tema) {
    botao.setAttribute("aria-pressed", tema === "escuro" ? "true" : "false");
  }

  refletir(temaAtual());

  botao.addEventListener("click", function () {
    var proximo = temaAtual() === "escuro" ? "claro" : "escuro";
    document.documentElement.setAttribute("data-tema", proximo);
    refletir(proximo);
    try {
      sessionStorage.setItem("tema", proximo);
    } catch (erro) {
      /* sessionStorage indisponível: o tema vale só nesta página */
    }
  });
})();
