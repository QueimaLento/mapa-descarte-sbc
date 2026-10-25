/**
 * mapa.js - Lógica do mapa e da lista de pontos.
 *
 * O arquivo dados/pontos.json é carregado uma única vez e mantido em memória.
 * Filtros, ordenação e localização existem apenas durante a visita: nada é
 * gravado em cookie, localStorage ou enviado para servidores.
 */

(function () {
  "use strict";

  // ------------------------------- Estado --------------------------------
  // Estado em memória: nunca persistido.
  const estado = {
    pontos: [],           // todos os pontos do JSON
    visiveis: [],         // pontos depois dos filtros
    busca: "",
    bairro: "",
    residuo: "",
    minhaPosicao: null,   // {lat, lng} somente quando o usuário autoriza
    marcadores: new Map(),// id -> L.Marker
    marcadorUsuario: null,
    ajustePendente: false,// encaixe do mapa adiado (aba do mapa oculta)
    mapa: null,
    camada: null
  };

  // ------------------------------- Elementos -----------------------------
  const el = {};

  function guardarElementos() {
    el.busca = document.getElementById("campo-busca");
    el.bairro = document.getElementById("campo-bairro");
    el.residuo = document.getElementById("campo-residuo");
    el.localizacao = document.getElementById("botao-localizacao");
    el.limpar = document.getElementById("botao-limpar");
    el.sugestao = document.getElementById("botao-sugestao");
    el.contagem = document.getElementById("contagem");
    el.avisos = document.getElementById("area-avisos");
    el.lista = document.getElementById("lista-pontos");
    el.listaVazia = document.getElementById("lista-vazia");
    el.painel = document.getElementById("painel");
    el.abaMapa = document.getElementById("aba-mapa");
    el.abaLista = document.getElementById("aba-lista");
  }

  // --------------------------- Configurações -----------------------------
  function aplicarConfig() {
    // Botão de sugestão só aparece se o link do formulário estiver preenchido.
    if (el.sugestao) {
      if (configDefinida(CONFIG.URL_FORM_SUGESTAO)) {
        el.sugestao.href = urlSegura(CONFIG.URL_FORM_SUGESTAO);
      } else {
        el.sugestao.setAttribute("hidden", "hidden");
      }
    }

    const autor = document.getElementById("rodape-autor");
    if (autor) {
      autor.textContent = configDefinida(CONFIG.AUTOR)
        ? "Responsável: " + CONFIG.AUTOR
        : "";
    }

    const inst = document.getElementById("rodape-instituicao");
    if (inst) {
      inst.textContent = configDefinida(CONFIG.INSTITUICAO)
        ? CONFIG.INSTITUICAO + " — " + CONFIG.CURSO
        : "";
    }

    const form = document.getElementById("rodape-formulario");
    if (form) {
      if (configDefinida(CONFIG.URL_FORM_SUGESTAO)) {
        const a = document.createElement("a");
        a.href = urlSegura(CONFIG.URL_FORM_SUGESTAO);
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Enviar sugestão de novo ponto";
        form.appendChild(a);
      }
    }

    const email = document.getElementById("rodape-email");
    if (email && configDefinida(CONFIG.EMAIL_CONTATO)) {
      const a = document.createElement("a");
      a.href = urlSegura(CONFIG.EMAIL_CONTATO);
      a.textContent = CONFIG.EMAIL_CONTATO;
      email.appendChild(a);
    }

    const repo = document.getElementById("rodape-repositorio");
    if (repo && configDefinida(CONFIG.URL_REPOSITORIO)) {
      const a = document.createElement("a");
      a.href = urlSegura(CONFIG.URL_REPOSITORIO);
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Código-fonte no GitHub";
      repo.appendChild(a);
    }
  }

  // ------------------------------- Avisos --------------------------------
  function mostrarAviso(classe, texto) {
    limparFilhos(el.avisos);
    const p = criarElementoTexto("p", "aviso " + classe, texto);
    el.avisos.appendChild(p);
  }

  // -------------------------------- Mapa ---------------------------------
  function iconePonto() {
    return L.divIcon({
      className: "",
      html: '<div class="marcador"><span aria-hidden="true">&#9679;</span></div>',
      iconSize: [34, 34],
      iconAnchor: [17, 32],
      popupAnchor: [0, -28]
    });
  }

  function iniciarMapa() {
    estado.mapa = L.map("mapa", {
      center: CONFIG.CENTRO_MAPA,
      zoom: CONFIG.ZOOM_INICIAL,
      minZoom: 11,
      maxZoom: 19,
      zoomControl: true
    });

    L.tileLayer(CONFIG.URL_TILES, {
      attribution: CONFIG.ATRIBUICAO,
      maxZoom: 19
    }).addTo(estado.mapa);

    estado.camada = L.layerGroup().addTo(estado.mapa);
  }

  function montarPopup(ponto) {
    // Construído com DOM e textContent: nada de innerHTML com dados externos.
    const div = document.createElement("div");
    div.appendChild(criarElementoTexto("p", "popup-titulo", ponto.nome));

    const ul = document.createElement("ul");
    ul.className = "popup-lista";

    ul.appendChild(criarElementoTexto("li", "", "Endereço: " + ponto.endereco));
    if (ponto.bairro) ul.appendChild(criarElementoTexto("li", "", "Bairro: " + ponto.bairro));
    const cep = cepDoPonto(ponto);
    if (cep) ul.appendChild(criarElementoTexto("li", "", "CEP: " + cep));
    if (ponto.horario) ul.appendChild(criarElementoTexto("li", "", "Horário: " + ponto.horario));

    if (ponto.telefone) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = montarLinkTelefone(ponto.telefone) || "#";
      link.textContent = "Telefone: " + ponto.telefone;
      li.appendChild(link);
      ul.appendChild(li);
    }

    if (ponto.residuos && ponto.residuos.length) {
      ul.appendChild(criarElementoTexto(
        "li", "",
        "Aceita: " + ponto.residuos.map(rotuloResiduo).join(", ")
      ));
    }

    const situacao = situacaoTexto(ponto);
    if (situacao) ul.appendChild(criarElementoTexto("li", "", situacao));
    div.appendChild(ul);

    return div;
  }

  function rotuloResiduo(codigo) {
    if (codigo === "medicamentos") return "medicamentos";
    if (codigo === "exames-de-imagem") return "exames de imagem";
    return codigo;
  }

  // ------------------------------ Busca ---------------------------------
  // Palavras digitadas, já sem acentos e em minúsculas.
  function termosDaBusca() {
    return normalizarTexto(estado.busca).split(" ").filter(Boolean);
  }

  // CEP: campo próprio quando existir, senão o primeiro encontrado em observacoes.
  function cepDoPonto(ponto) {
    if (ponto.cep) return String(ponto.cep);
    const achado = String(ponto.observacoes || "").match(/\b\d{5}-\d{3}\b/);
    return achado ? achado[0] : "";
  }

  // Todos os campos pesquisáveis de um ponto, juntos em um texto só.
  function textoPesquisavel(ponto) {
    return [
      ponto.nome,
      ponto.endereco,
      ponto.bairro,
      ponto.cidade,
      cepDoPonto(ponto),
      ponto.telefone,
      ponto.horario,
      ponto.tipo,
      (ponto.residuos || []).map(rotuloResiduo).join(" "),
      ponto.observacoes
    ].filter(Boolean).join(" ");
  }

  // Ordem de importância quando há busca: nome primeiro, depois bairro.
  function pontuarRelevancia(ponto, termos) {
    const nome = normalizarTexto(ponto.nome);
    const nomeEBairro = nome + " " + normalizarTexto(ponto.bairro);
    const buscaCompleta = termos.join(" ");

    if (termos.every(function (t) { return nome.indexOf(t) !== -1; })) {
      if (nome === buscaCompleta) return 0;
      if (nome.indexOf(buscaCompleta) === 0) return 1;
      return 2;
    }
    if (termos.every(function (t) { return nomeEBairro.indexOf(t) !== -1; })) return 3;
    return 4;
  }

  /**
   * Devolve um fragmento com o texto original, envolvendo em <mark> os trechos
   * que batem com a busca (mesmo com acentos diferentes).
   * @param {string} texto Texto original (com acentos).
   * @param {string[]} termos Termos já normalizados.
   * @returns {DocumentFragment} Texto puro e trechos destacados.
   */
  function destacarTrecho(texto, termos) {
    const original = texto === null || texto === undefined ? "" : String(texto);
    const fragmento = document.createDocumentFragment();
    if (!termos || !termos.length || !original) {
      fragmento.appendChild(document.createTextNode(original));
      return fragmento;
    }

    const alvo = normalizarTextoMantendoTamanho(original);
    const trechos = [];
    termos.forEach(function (termo) {
      let posicao = alvo.indexOf(termo);
      while (posicao !== -1 && termo.length) {
        trechos.push([posicao, posicao + termo.length]);
        posicao = alvo.indexOf(termo, posicao + termo.length);
      }
    });
    if (!trechos.length) {
      fragmento.appendChild(document.createTextNode(original));
      return fragmento;
    }

    // Junta trechos que se tocam ou se sobrepõem.
    trechos.sort(function (a, b) { return a[0] - b[0]; });
    const juntos = [];
    trechos.forEach(function (t) {
      const ultimo = juntos[juntos.length - 1];
      if (ultimo && t[0] <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], t[1]);
      else juntos.push([t[0], t[1]]);
    });

    let cursor = 0;
    juntos.forEach(function (t) {
      if (t[0] > cursor) {
        fragmento.appendChild(document.createTextNode(original.slice(cursor, t[0])));
      }
      const marca = document.createElement("mark");
      marca.textContent = original.slice(t[0], t[1]);
      fragmento.appendChild(marca);
      cursor = t[1];
    });
    if (cursor < original.length) {
      fragmento.appendChild(document.createTextNode(original.slice(cursor)));
    }
    return fragmento;
  }

  // Elemento de texto com prefixo fixo (ex.: "Bairro: ") e destaque da busca.
  function criarElementoDestacado(tag, classe, prefixo, texto, termos) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (prefixo) elemento.appendChild(document.createTextNode(prefixo));
    elemento.appendChild(destacarTrecho(texto, termos));
    return elemento;
  }

  function situacaoTexto(ponto) {
    if (ponto.status === "confirmado" && ponto.confirmado_em) {
      return "Informação confirmada em " + formatarData(ponto.confirmado_em) + ".";
    }
    return "";
  }

  function atualizarMarcadores() {
    if (!estado.camada) return;
    estado.camada.clearLayers();
    estado.marcadores.clear();

    estado.visiveis.forEach(function (ponto) {
      if (typeof ponto.lat !== "number" || typeof ponto.lng !== "number") return;
      const marcador = L.marker([ponto.lat, ponto.lng], {
        icon: iconePonto(),
        title: ponto.nome,
        alt: "Ponto: " + ponto.nome
      });
      marcador.bindPopup(montarPopup(ponto));
      marcador.addTo(estado.camada);
      estado.marcadores.set(ponto.id, marcador);
    });

    if (estado.marcadorUsuario) {
      estado.marcadorUsuario.addTo(estado.camada);
    }
  }

  // ------------------------------- Lista ---------------------------------
  function criarItemLista(ponto, termos) {
    const buscaAtiva = !!(termos && termos.length);
    const li = criarElementoTexto("li", "item-ponto");
    li.id = "ponto-" + ponto.id;

    li.appendChild(
      buscaAtiva
        ? criarElementoDestacado("h3", "", "", ponto.nome, termos)
        : criarElementoTexto("h3", "", ponto.nome)
    );

    li.appendChild(
      buscaAtiva
        ? criarElementoDestacado("p", "endereco", "", ponto.endereco, termos)
        : criarElementoTexto("p", "endereco", ponto.endereco)
    );

    const cep = cepDoPonto(ponto);
    if (ponto.bairro || cep) {
      const linhaOnde = document.createElement("p");
      linhaOnde.className = "meta";
      if (ponto.bairro) {
        linhaOnde.appendChild(document.createTextNode("Bairro: "));
        linhaOnde.appendChild(
          buscaAtiva
            ? destacarTrecho(ponto.bairro, termos)
            : document.createTextNode(ponto.bairro)
        );
        if (cep) linhaOnde.appendChild(document.createTextNode(" · CEP: " + cep));
      } else {
        linhaOnde.textContent = "CEP: " + cep;
      }
      li.appendChild(linhaOnde);
    }

    const meta = [];
    if (ponto.horario) meta.push("Horário: " + ponto.horario);
    if (ponto.telefone) meta.push("Telefone: " + ponto.telefone);
    if (ponto.residuos && ponto.residuos.length) {
      meta.push("Aceita: " + ponto.residuos.map(rotuloResiduo).join(", "));
    }
    if (estado.minhaPosicao && typeof ponto.lat === "number") {
      const metros = calcularDistanciaMetros(
        estado.minhaPosicao.lat, estado.minhaPosicao.lng, ponto.lat, ponto.lng
      );
      meta.push("A " + formatarDistancia(metros) + " de você");
    }
    if (meta.length) {
      li.appendChild(criarElementoTexto("p", "meta", meta.join(" · ")));
    }

    const acoes = document.createElement("div");
    acoes.className = "acoes";

    // "Ver no mapa"
    const botaoMapa = document.createElement("button");
    botaoMapa.type = "button";
    botaoMapa.className = "botao botao-secundario";
    botaoMapa.textContent = "Ver no mapa";
    botaoMapa.addEventListener("click", function () {
      focarNoPonto(ponto);
    });
    acoes.appendChild(botaoMapa);

    // "Como chegar"
    const linkChegar = document.createElement("a");
    linkChegar.className = "botao botao-secundario";
    if (typeof ponto.lat === "number" && typeof ponto.lng === "number") {
      const origem = estado.minhaPosicao
        ? estado.minhaPosicao.lat + "," + estado.minhaPosicao.lng + "&"
        : "";
      linkChegar.href =
        "https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=" +
        origem + ponto.lat + "," + ponto.lng;
    } else {
      linkChegar.href = montarBuscaEndereco(ponto.endereco, ponto.cidade || CONFIG.CIDADE);
    }
    linkChegar.target = "_blank";
    linkChegar.rel = "noopener";
    linkChegar.textContent = "Como chegar";
    acoes.appendChild(linkChegar);

    // "Ligar"
    const linkTelefone = montarLinkTelefone(ponto.telefone);
    if (linkTelefone) {
      const a = document.createElement("a");
      a.className = "botao botao-secundario";
      a.href = linkTelefone;
      a.textContent = "Ligar";
      acoes.appendChild(a);
    }

    li.appendChild(acoes);
    return li;
  }

  function focarNoPonto(ponto) {
    // No celular, mostra a aba do mapa antes de abrir o popup.
    if (window.matchMedia("(max-width: 860px)").matches) {
      alternarAba("mapa");
    }
    const marcador = estado.marcadores.get(ponto.id);
    if (marcador) {
      estado.mapa.setView([ponto.lat, ponto.lng], Math.max(estado.mapa.getZoom(), 16));
      marcador.openPopup();
    } else {
      mostrarAviso(
        "aviso-atencao",
        "Este ponto ainda não tem coordenadas no mapa. Use “Como chegar” para abrir o endereço no OpenStreetMap."
      );
      anunciar("Este ponto ainda não tem coordenadas no mapa.");
    }
  }

  function renderizar() {
    const termos = termosDaBusca();
    limparFilhos(el.lista);

    estado.visiveis.forEach(function (ponto) {
      el.lista.appendChild(criarItemLista(ponto, termos));
    });

    const vazio = estado.visiveis.length === 0;
    el.listaVazia.hidden = !vazio;
    el.lista.hidden = vazio;
    if (vazio) el.listaVazia.textContent = mensagemListaVazia();

    const texto = montarTextoContagem(estado.visiveis.length, estado.pontos.length, termos);
    el.contagem.textContent = texto;

    atualizarMarcadores();
    anunciar(texto);
  }

  // Texto do contador, considerando a busca digitada.
  function montarTextoContagem(visiveis, total, termos) {
    const busca = estado.busca.trim();
    if (busca) {
      if (visiveis === 0) return 'Nenhum ponto para "' + busca + '".';
      return visiveis + " de " + total + (visiveis === 1 ? " ponto" : " pontos") +
        ' para "' + busca + '".';
    }
    if (visiveis === 0) return "Nenhum ponto encontrado.";
    if (visiveis === total) return total + " pontos encontrados.";
    return visiveis + " de " + total + " pontos encontrados.";
  }

  // Orientação quando nenhum ponto passa pelos filtros.
  function mensagemListaVazia() {
    const partes = [];
    const busca = estado.busca.trim();
    if (busca) partes.push('Nenhum ponto corresponde a "' + busca + '".');
    else partes.push("Nenhum ponto corresponde aos filtros atuais.");
    if (estado.bairro) partes.push('Bairro: "' + estado.bairro + '".');
    if (estado.residuo) partes.push("Tipo de resíduo: " + rotuloResiduo(estado.residuo) + ".");
    partes.push("Confira a grafia, use menos palavras ou clique em “Limpar filtros”.");
    return partes.join(" ");
  }

  // Encaixa o mapa nos pontos filtrados (só quando há busca ou filtro ativo).
  function ajustarMapaAosVisiveis() {
    const filtrando = !!(estado.busca.trim() || estado.bairro || estado.residuo);
    if (!filtrando || !estado.mapa || !estado.camada) {
      estado.ajustePendente = false;
      return;
    }

    const comCoordenada = estado.visiveis.filter(function (p) {
      return typeof p.lat === "number" && typeof p.lng === "number";
    });
    if (!comCoordenada.length) return;

    const cont = estado.mapa.getContainer();
    if (!cont || cont.offsetWidth === 0) {
      estado.ajustePendente = true; // mapa escondido: faz ao voltar para a aba
      return;
    }

    const limites = L.latLngBounds(
      comCoordenada.map(function (p) { return [p.lat, p.lng]; })
    );
    estado.mapa.fitBounds(limites, {
      padding: [30, 30],
      maxZoom: 16,
      animate: false
    });
    estado.ajustePendente = false;
  }

  // ------------------------------- Filtros -------------------------------
  function aplicarFiltros() {
    const termos = termosDaBusca();

    estado.visiveis = estado.pontos.filter(function (p) {
      if (estado.bairro && p.bairro !== estado.bairro) return false;
      if (estado.residuo && (p.residuos || []).indexOf(estado.residuo) === -1) return false;
      if (termos.length) {
        // Todas as palavras precisam aparecer (em qualquer ordem e sem acento).
        const alvo = normalizarTexto(textoPesquisavel(p));
        if (!termos.every(function (termo) { return alvo.indexOf(termo) !== -1; })) {
          return false;
        }
      }
      return true;
    });

    // Ordenação: localização > relevância da busca > ordem alfabética.
    if (estado.minhaPosicao) {
      const pos = estado.minhaPosicao;
      estado.visiveis.sort(function (a, b) {
        const da = typeof a.lat === "number"
          ? calcularDistanciaMetros(pos.lat, pos.lng, a.lat, a.lng) : Infinity;
        const db = typeof b.lat === "number"
          ? calcularDistanciaMetros(pos.lat, pos.lng, b.lat, b.lng) : Infinity;
        return da - db;
      });
    } else if (termos.length) {
      estado.visiveis.sort(function (a, b) {
        const diferenca = pontuarRelevancia(a, termos) - pontuarRelevancia(b, termos);
        return diferenca !== 0
          ? diferenca
          : a.nome.localeCompare(b.nome, "pt-BR");
      });
    } else {
      estado.visiveis.sort(function (a, b) {
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
    }

    renderizar();
    ajustarMapaAosVisiveis();
  }

  function preencherBairros() {
    const bairros = Array.from(
      new Set(
        estado.pontos
          .map(function (p) { return p.bairro; })
          .filter(Boolean)
      )
    ).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });

    bairros.forEach(function (bairro) {
      const opcao = document.createElement("option");
      opcao.value = bairro;
      opcao.textContent = bairro;
      el.bairro.appendChild(opcao);
    });
  }

  // ---------------------------- Geolocalização --------------------------
  function pedirLocalizacao() {
    if (!navigator.geolocation) {
      mostrarAviso(
        "aviso-atencao",
        "Este navegador não permite compartilhar a localização. Você ainda pode buscar por bairro ou endereço."
      );
      return;
    }

    el.localizacao.disabled = true;
    el.localizacao.textContent = "Localizando…";

    navigator.geolocation.getCurrentPosition(
      function (posicao) {
        el.localizacao.disabled = false;
        el.localizacao.textContent = "Minha localização";

        estado.minhaPosicao = {
          lat: posicao.coords.latitude,
          lng: posicao.coords.longitude
        };

        if (estado.marcadorUsuario) {
          estado.mapa.removeLayer(estado.marcadorUsuario);
        }
        estado.marcadorUsuario = L.marker(
          [estado.minhaPosicao.lat, estado.minhaPosicao.lng],
          {
            icon: L.divIcon({ className: "", html: '<div class="marcador-usuario"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
            title: "Você está aqui",
            alt: "Sua localização atual"
          }
        );
        estado.mapa.setView([estado.minhaPosicao.lat, estado.minhaPosicao.lng], 15);

        aplicarFiltros();
        mostrarAviso(
          "aviso-informacao",
          "Lista ordenada pela distância a partir do seu aparelho. A localização não foi enviada nem salva."
        );
      },
      function (erro) {
        el.localizacao.disabled = false;
        el.localizacao.textContent = "Minha localização";
        const mensagens = {
          1: "Você não autorizou o acesso à localização. A lista continua em ordem alfabética.",
          2: "Não foi possível obter sua localização agora. A lista continua em ordem alfabética.",
          3: "A busca por localização demorou demais. Tente novamente."
        };
        mostrarAviso(
          "aviso-atencao",
          mensagens[erro.code] || "Não foi possível usar sua localização."
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  // -------------------------------- Abas ---------------------------------
  function alternarAba(qual) {
    const mapa = qual === "mapa";
    el.painel.setAttribute("data-aba", mapa ? "mapa" : "lista");
    el.abaMapa.setAttribute("aria-selected", mapa ? "true" : "false");
    el.abaLista.setAttribute("aria-selected", mapa ? "false" : "true");
    if (mapa && estado.mapa) {
      // Reajusta o tamanho após voltar a ficar visível.
      window.setTimeout(function () {
        estado.mapa.invalidateSize();
        if (estado.ajustePendente) ajustarMapaAosVisiveis();
      }, 120);
    }
  }

  // ------------------------------ Carregamento --------------------------
  function tratarErroCarregamento() {
    mostrarAviso(
      "aviso-erro",
      "Não foi possível carregar dados/pontos.json. O arquivo precisa ser aberto " +
      "por um servidor: o GitHub Pages, o Live Server do VS Code ou, localmente, " +
      "\"python -m http.server\". Abrir o index.html direto pelo computador (file://) não carrega os dados."
    );
    el.contagem.textContent = "Não foi possível carregar os pontos.";
  }

  function iniciar() {
    guardarElementos();
    aplicarConfig();

    if (typeof L === "undefined") {
      mostrarAviso(
        "aviso-erro",
        "A biblioteca do mapa (Leaflet) não foi carregada. Verifique sua conexão com a internet e recarregue a página."
      );
      return;
    }

    iniciarMapa();

    fetch("dados/pontos.json", { cache: "no-cache" })
      .then(function (resposta) {
        if (!resposta.ok) throw new Error("HTTP " + resposta.status);
        return resposta.json();
      })
      .then(function (dados) {
        estado.pontos = Array.isArray(dados.pontos) ? dados.pontos : [];
        preencherBairros();
        aplicarFiltros();
      })
      .catch(function (erro) {
        console.error(erro);
        tratarErroCarregamento();
      });

    // Filtros (somente em memória).
    el.busca.addEventListener("input", function () {
      estado.busca = el.busca.value;
      aplicarFiltros();
    });
    el.bairro.addEventListener("change", function () {
      estado.bairro = el.bairro.value;
      aplicarFiltros();
    });
    el.residuo.addEventListener("change", function () {
      estado.residuo = el.residuo.value;
      aplicarFiltros();
    });
    el.limpar.addEventListener("click", function () {
      estado.busca = "";
      estado.bairro = "";
      estado.residuo = "";
      estado.minhaPosicao = null;
      el.busca.value = "";
      el.bairro.value = "";
      el.residuo.value = "";
      if (estado.marcadorUsuario) {
        estado.mapa.removeLayer(estado.marcadorUsuario);
        estado.marcadorUsuario = null;
      }
      estado.mapa.setView(CONFIG.CENTRO_MAPA, CONFIG.ZOOM_INICIAL);
      mostrarAviso("aviso-informacao", "Filtros limpos.");
      aplicarFiltros();
    });
    el.localizacao.addEventListener("click", pedirLocalizacao);

    // Abas (celular)
    el.abaMapa.addEventListener("click", function () { alternarAba("mapa"); });
    el.abaLista.addEventListener("click", function () { alternarAba("lista"); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
