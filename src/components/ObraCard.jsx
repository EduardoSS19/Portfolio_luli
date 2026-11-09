import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useScrollReveal } from '../hooks/useScrollReveal.js'
import { useCardEmFoco } from '../hooks/useCardEmFoco.js'

const EASE_ABRIR = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EASE_FECHAR = 'cubic-bezier(0.4, 0, 0.2, 1)'
const SEM_RECORTE = 'inset(0px 0px 0px 0px)'
const SEM_TRANSFORMACAO = 'translate(0px, 0px) scale(1)'

// Safari antigo (< 15.4) não tem <dialog>.showModal(): usamos o atributo "open" como alternativa.
const dialogAberto = dialog => Boolean(dialog?.hasAttribute('open'))
function abrirDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal()
  else dialog.setAttribute('open', '')
}
function fecharDialog(dialog) {
  if (typeof dialog.close === 'function') dialog.close()
  else dialog.removeAttribute('open')
}

// Miniatura de vídeo à prova de falhas: se a do banco estiver vazia ou não carregar,
// tentamos as imagens públicas do próprio YouTube; se nada carregar, o card mostra um
// fundo próprio em vez de ficar vazio com só o botão de play.
const urlYoutube = (videoId, tamanho = 'hqdefault') =>
  `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${tamanho}.jpg`
const miniaturaDoVideo = midia => midia.miniatura || urlYoutube(midia.videoId)
function falhaNaMiniatura(event, midia) {
  const imagem = event.currentTarget
  const alternativas = [urlYoutube(midia.videoId), urlYoutube(midia.videoId, 'mqdefault')]
  const tentativa = Number(imagem.dataset.tentativa || 0)
  if (tentativa < alternativas.length) {
    imagem.dataset.tentativa = String(tentativa + 1)
    imagem.src = alternativas[tentativa]
    return
  }
  imagem.style.visibility = 'hidden'
  imagem.closest('.obra-video-trigger')?.classList.add('sem-miniatura')
}

// Na grade os cards são pequenos: pedimos ao Cloudinary uma versão menor (mais rápida no celular).
const imagemDaGrade = src =>
  typeof src === 'string' ? src.replace('/upload/f_auto,q_auto,w_1400/', '/upload/f_auto,q_auto,w_640/') : src

const esperar = ms => new Promise(resolve => window.setTimeout(resolve, ms))

function reduzirMovimento() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Calcula onde a imagem ampliada deve "nascer": exatamente sobre a miniatura do card.
// A miniatura usa object-fit: cover, então escalamos para cobrir a caixa inteira
// e recortamos o excesso com clip-path. Assim não há salto visual entre as duas.
function calcularQuadroDaMiniatura(imagemFoco, miniatura) {
  const origem = miniatura.getBoundingClientRect()
  const destino = imagemFoco.getBoundingClientRect()
  if (!origem.width || !origem.height || !destino.width || !destino.height) return null

  const escala = Math.max(origem.width / destino.width, origem.height / destino.height)
  const x = origem.left + origem.width / 2 - (destino.left + destino.width / 2)
  const y = origem.top + origem.height / 2 - (destino.top + destino.height / 2)
  const recorteX = Math.max(0, (destino.width - origem.width / escala) / 2)
  const recorteY = Math.max(0, (destino.height - origem.height / escala) / 2)

  return {
    transform: `translate(${x}px, ${y}px) scale(${escala})`,
    clipPath: `inset(${recorteY}px ${recorteX}px ${recorteY}px ${recorteX}px)`,
  }
}

export function ObraCard({
  titulo,
  imagem,
  imagens: imagensDaObra = [],
  midias: midiasDaObra = [],
  descricao,
  detalhe,
  fichaTecnica = {},
  categoria,
  categoriaNome,
  tipoDeArte = 'obra',
  invertido,
  modoGrade = false,
  indiceGrade = 0,
  estiloGrade,
}) {
  const [expandido, setExpandido] = useState(false)
  const [indiceImagem, setIndiceImagem] = useState(0)
  const [direcao, setDirecao] = useState(1)
  const [focoAberto, setFocoAberto] = useState(false)
  const [focoFechando, setFocoFechando] = useState(false)
  const [videoAtivoId, setVideoAtivoId] = useState(null)
  const [videoFocoAtivo, setVideoFocoAtivo] = useState(false)
  const [focoPreparado, setFocoPreparado] = useState(false)
  const [ref, visivel] = useScrollReveal(
    modoGrade ? 0.02 : 0,
    modoGrade ? '0px 0px 12% 0px' : '0px 0px -8% 0px',
    { once: modoGrade },
  )
  const emFoco = useCardEmFoco(ref)
  const imagemRef = useRef(null)
  const dialogRef = useRef(null)
  const imagemFocoRef = useRef(null)
  const animacaoInicialRef = useRef(true)
  const inicioArrasteRef = useRef(null)
  const arrasteConcluidoRef = useRef(false)
  const inicioArrasteFocoRef = useRef(null)
  const focoPendenteRef = useRef(false)
  const focoFechandoRef = useRef(false)
  const focoAbrindoRef = useRef(false)
  const seguirRef = useRef(0)
  const detalhesFixadosRef = useRef(null)
  const overflowAnteriorRef = useRef('')
  const midias = midiasDaObra.length
    ? midiasDaObra
    : (imagensDaObra.length ? imagensDaObra : imagem ? [imagem] : [])
      .map(src => typeof src === 'string' ? { tipo: 'imagem', src } : src)
  const indicesImagem = midias
    .map((midia, indice) => midia.tipo === 'imagem' ? indice : -1)
    .filter(indice => indice >= 0)
  const midiaAtiva = midias[indiceImagem]
  const dimensoes = fichaTecnica.dimensoes || {}
  const valoresTecnicos = [
    ['Técnica', fichaTecnica.tecnica], ['Material', fichaTecnica.material],
    ['Suporte', fichaTecnica.suporte], ['Ano', fichaTecnica.ano],
    ['Dimensões', [dimensoes.altura, dimensoes.largura, dimensoes.profundidade].some(Boolean)
      ? [
        dimensoes.altura && 'Alt. ' + dimensoes.altura,
        dimensoes.largura && 'Larg. ' + dimensoes.largura,
        dimensoes.profundidade && 'Prof. ' + dimensoes.profundidade,
      ].filter(Boolean).join(' × ') + (dimensoes.unidade ? ' ' + dimensoes.unidade : '')
      : ''],
    ['Série', fichaTecnica.serie], ['Edição', fichaTecnica.edicao], ['Tiragem', fichaTecnica.tiragem],
    ['Assinatura', fichaTecnica.assinada === true ? 'Assinada' : fichaTecnica.assinada === false ? 'Não assinada' : ''],
    ['Local de criação', fichaTecnica.localCriacao], ['Conservação', fichaTecnica.conservacao],
    ['Exposições', fichaTecnica.exposicoes], ['Disponibilidade', fichaTecnica.disponibilidade],
    ['Preço', fichaTecnica.preco ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: fichaTecnica.moeda || 'BRL' }).format(Number(fichaTecnica.preco)) : ''],
  ].filter(([, valor]) => valor !== null && valor !== undefined && String(valor).trim() !== '')
  const temDetalhes = Boolean(detalhe || valoresTecnicos.length)

  // Centraliza o card seguindo a posição REAL dele a cada quadro. Assim, se o card
  // crescer (detalhes abrindo) a rolagem acompanha junto, sem esperar nem "corrigir" depois.
  function centralizarCard(minimoMs = 0) {
    const card = ref.current
    if (!card) return Promise.resolve()
    cancelAnimationFrame(seguirRef.current)

    const calcularAlvo = () => {
      const rect = card.getBoundingClientRect()
      const maximo = document.documentElement.scrollHeight - window.innerHeight
      const alvo = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2
      return Math.max(0, Math.min(alvo, maximo))
    }

    if (reduzirMovimento()) {
      window.scrollTo({ top: calcularAlvo(), behavior: 'auto' })
      return Promise.resolve()
    }

    return new Promise(resolve => {
      const inicio = performance.now()
      let interrompido = false
      const interromper = () => { interrompido = true }

      function finalizar() {
        window.removeEventListener('wheel', interromper)
        window.removeEventListener('touchstart', interromper)
        resolve()
      }

      function passo(agora) {
        const decorrido = agora - inicio
        if (interrompido || decorrido > 1400) return finalizar()

        const falta = calcularAlvo() - window.scrollY
        if (Math.abs(falta) < 1 && decorrido >= minimoMs) return finalizar()

        const tamanho = Math.max(1, Math.abs(falta) * 0.16)
        const deslocamento = Math.sign(falta) * Math.min(Math.abs(falta), tamanho)
        window.scrollTo({ top: window.scrollY + deslocamento, behavior: 'auto' })
        seguirRef.current = requestAnimationFrame(passo)
      }

      window.addEventListener('wheel', interromper, { passive: true })
      window.addEventListener('touchstart', interromper, { passive: true })
      seguirRef.current = requestAnimationFrame(passo)
    })
  }

  function centralizarAoClicarCard(event) {
    if (event.target.closest('button, a, iframe, .obra-focus')) return
    if (modoGrade) {
      void abrirFoco()
      return
    }
    centralizarCard()
  }

  function abrirDetalhesNoHover() {
    if (!temDetalhes || detalhesFixadosRef.current !== null || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    setExpandido(true)
  }

  function fecharDetalhesForaDoHover() {
    if (!detalhe || detalhesFixadosRef.current !== null || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    setExpandido(false)
  }

  async function abrirFoco() {
    const dialog = dialogRef.current
    if (!dialog || dialogAberto(dialog) || focoFechandoRef.current) return

    focoPendenteRef.current = false
    // A imagem grande só começa a carregar no primeiro uso (ou ao passar o mouse).
    flushSync(() => {
      setFocoPreparado(true)
      setVideoFocoAtivo(midiaAtiva?.tipo === 'youtube')
    })

    const imagemFoco = imagemFocoRef.current
    if (imagemFoco) {
      await Promise.race([typeof imagemFoco.decode === 'function' ? imagemFoco.decode().catch(() => {}) : Promise.resolve(), esperar(1500)])
    }
    if (dialogAberto(dialog) || focoFechandoRef.current) return

    overflowAnteriorRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Esconde a miniatura e abre o dialog no mesmo quadro: sem piscar e sem teletransporte.
    flushSync(() => setFocoAberto(true))
    abrirDialog(dialog)

    const miniatura = imagemRef.current
    if (!imagemFoco || !miniatura || typeof imagemFoco.animate !== 'function' || reduzirMovimento()) return
    const quadro = calcularQuadroDaMiniatura(imagemFoco, miniatura)
    if (!quadro) return

    focoAbrindoRef.current = true
    const animacao = imagemFoco.animate(
      [
        { transform: quadro.transform, clipPath: quadro.clipPath },
        { transform: SEM_TRANSFORMACAO, clipPath: SEM_RECORTE },
      ],
      { duration: 640, easing: EASE_ABRIR, fill: 'both' },
    )
    await Promise.race([animacao.finished.catch(() => {}), esperar(900)])
    animacao.cancel()
    focoAbrindoRef.current = false
  }

  async function fecharFoco() {
    const dialog = dialogRef.current
    if (!dialogAberto(dialog) || focoFechandoRef.current || focoAbrindoRef.current) return

    focoFechandoRef.current = true
    setFocoFechando(true)

    const imagemFoco = imagemFocoRef.current
    const miniatura = imagemRef.current
    const quadro = imagemFoco && miniatura && !reduzirMovimento()
      ? calcularQuadroDaMiniatura(imagemFoco, miniatura)
      : null

    let animacao = null
    if (quadro && typeof imagemFoco.animate === 'function') {
      animacao = imagemFoco.animate(
        [
          { transform: SEM_TRANSFORMACAO, clipPath: SEM_RECORTE },
          { transform: quadro.transform, clipPath: quadro.clipPath },
        ],
        { duration: 460, easing: EASE_FECHAR, fill: 'both' },
      )
      await Promise.race([animacao.finished.catch(() => {}), esperar(700)])
    }

    // Mostra a miniatura e fecha o dialog no mesmo quadro: a imagem "pousa" no card.
    flushSync(() => setFocoAberto(false))
    fecharDialog(dialog)
    animacao?.cancel()
    document.body.style.overflow = overflowAnteriorRef.current
    setFocoFechando(false)
    setVideoFocoAtivo(false)
    focoFechandoRef.current = false
    imagemRef.current?.focus({ preventScroll: true })
  }

  function alternarDetalhes() {
    const novoEstado = !expandido
    detalhesFixadosRef.current = novoEstado
    setExpandido(novoEstado)
    // Expande e centraliza ao mesmo tempo; a rolagem acompanha o card enquanto ele cresce.
    void centralizarCard(450)
  }

  async function focarImagem(event) {
    if (midiaAtiva?.tipo !== 'imagem') return
    if (arrasteConcluidoRef.current) {
      arrasteConcluidoRef.current = false
      return
    }
    event.preventDefault()
    if (focoPendenteRef.current || dialogAberto(dialogRef.current)) return
    focoPendenteRef.current = true
    await centralizarCard()
    await abrirFoco()
  }

  function navegarImagem(direcao) {
    setDirecao(direcao)
    setVideoAtivoId(null)
    setIndiceImagem(indiceAtual => (indiceAtual + direcao + midias.length) % midias.length)
  }

  function navegarImagemFoco(direcao) {
    if (indicesImagem.length < 2) return
    const indiceAtual = indicesImagem.indexOf(indiceImagem)
    const proximo = (indiceAtual + direcao + indicesImagem.length) % indicesImagem.length
    setDirecao(direcao)
    setIndiceImagem(indicesImagem[proximo])
  }

  function iniciarArrasteFoco(event) {
    inicioArrasteFocoRef.current = { x: event.clientX, pointerId: event.pointerId }
    if (event.currentTarget instanceof Element && 'setPointerCapture' in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  function finalizarArrasteFoco(event) {
    const inicio = inicioArrasteFocoRef.current
    if (inicio === null || event.pointerId !== inicio.pointerId) return
    const distancia = event.clientX - inicio.x
    inicioArrasteFocoRef.current = null
    if (Math.abs(distancia) > 42 && indicesImagem.length > 1) {
      navegarImagemFoco(distancia < 0 ? 1 : -1)
    }
  }

  // Avança automaticamente pelos itens do carrossel enquanto o card está visível.
  // Pausa fora da viewport, com o visualizador aberto ou durante a reprodução de vídeo.
  useEffect(() => {
    if (midias.length < 2 || !visivel || focoAberto || videoAtivoId) return undefined

    const intervalo = window.setInterval(() => {
      if (document.hidden) return
      setDirecao(1)
      setIndiceImagem(indiceAtual => (indiceAtual + 1) % midias.length)
    }, 4500)

    return () => window.clearInterval(intervalo)
  }, [midias.length, visivel, focoAberto, videoAtivoId])

  useEffect(() => {
    const imagem = imagemRef.current
    if (!imagem || typeof imagem.animate !== 'function' || reduzirMovimento()) return

    // Web Animations API nativa: sem depender de CDN para uma transição não essencial.
    let animacao
    try {
      animacao = imagem.animate(
        [
          { opacity: 0.35, transform: `translateX(${direcao * 26}px) scale(1.035)` },
          { opacity: 1, transform: 'translateX(0) scale(1)' },
        ],
        { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      )
    } catch {
      // Sem suporte à animação, a troca de imagem continua normalmente.
    }

    return () => animacao?.cancel()
  }, [indiceImagem, direcao])

  useEffect(() => () => {
    if (dialogAberto(dialogRef.current)) fecharDialog(dialogRef.current)
    if (document.body.style.overflow === 'hidden') {
      document.body.style.overflow = overflowAnteriorRef.current
    }
  }, [])

  useEffect(() => {
    if (!focoAberto) return undefined

    function lidarEscape(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        void fecharFoco()
      }
    }

    window.addEventListener('keydown', lidarEscape, true)
    return () => window.removeEventListener('keydown', lidarEscape, true)
  }, [focoAberto])

  function selecionarMiniatura(indice) {
    if (indice === indiceImagem) return
    setDirecao(indice > indiceImagem ? 1 : -1)
    setVideoAtivoId(null)
    setIndiceImagem(indice)
  }

  function iniciarArraste(event) {
    if (midias.length < 2 || event.target.closest('.carrossel-seta, .carrossel-indice')) return
    arrasteConcluidoRef.current = false
    inicioArrasteRef.current = { x: event.clientX, y: event.clientY }
    if (event.target instanceof Element && 'setPointerCapture' in event.target) {
      event.target.setPointerCapture(event.pointerId)
    }
  }

  function finalizarArraste(event) {
    if (midias.length < 2 || inicioArrasteRef.current === null) return
    const distanciaX = event.clientX - inicioArrasteRef.current.x
    const distanciaY = event.clientY - inicioArrasteRef.current.y
    inicioArrasteRef.current = null
    if (Math.abs(distanciaX) > 42 && Math.abs(distanciaX) > Math.abs(distanciaY) * 1.15) {
      arrasteConcluidoRef.current = true
      window.setTimeout(() => { arrasteConcluidoRef.current = false }, 0)
      navegarImagem(distanciaX < 0 ? 1 : -1)
    }
  }

  return (
    <>
      <article
        ref={ref}
        className={`obra arte-${tipoDeArte} categoria-${categoria} ${midias.some(midia => midia.tipo === 'youtube') ? 'tem-video' : ''} ${midiaAtiva?.tipo === 'youtube' ? 'midia-video' : ''} ${modoGrade ? 'modo-grade' : ''} ${visivel ? 'visivel' : ''} ${emFoco ? 'em-foco' : ''} ${invertido ? 'invertido' : ''} ${focoAberto ? 'foco-ativo' : ''}`}
        style={modoGrade ? estiloGrade : undefined}
        data-grade-indice={modoGrade ? indiceGrade : undefined}
        data-obra-chave={`${categoria || 'obra'}::${titulo || indiceGrade}`}
        onClick={centralizarAoClicarCard}
      >
        <div className="obra-galeria">
          <div
            className={`obra-imagem ${midias.length ? '' : 'obra-imagem-placeholder'} ${midias.length > 1 ? 'tem-carrossel' : ''}`}
            onPointerDown={midias.length > 1 ? iniciarArraste : undefined}
            onPointerUp={midias.length > 1 ? finalizarArraste : undefined}
            onPointerCancel={midias.length > 1 ? () => { inicioArrasteRef.current = null } : undefined}
            onLostPointerCapture={midias.length > 1 ? () => { inicioArrasteRef.current = null } : undefined}
          >
            {midiaAtiva ? (
              <>
                {midiaAtiva.tipo === 'imagem' ? (
                  <>
                    <button
                      ref={imagemRef}
                      type="button"
                      className="obra-zoom-trigger"
                      aria-label={`Ampliar obra ${titulo}, imagem ${indicesImagem.indexOf(indiceImagem) + 1} de ${indicesImagem.length}`}
                      onClick={focarImagem}
                      onPointerEnter={() => setFocoPreparado(true)}
                      onFocus={() => setFocoPreparado(true)}
                    >
                      <img
                        key={midiaAtiva.src}
                        src={modoGrade ? imagemDaGrade(midiaAtiva.src) : midiaAtiva.src}
                        alt={`${titulo} — imagem ${indicesImagem.indexOf(indiceImagem) + 1} de ${indicesImagem.length}`}
                        loading={modoGrade ? "eager" : "lazy"}
                        fetchPriority={modoGrade && indiceGrade < 4 ? "high" : "auto"}
                        decoding="async"
                        draggable="false"
                      />
                      <span className="obra-zoom-label" aria-hidden="true">↗</span>
                    </button>
                    {tipoDeArte === 'glitch' && (
                      <>
                        <img className="glitch-camada glitch-ciano" src={midiaAtiva.src} alt="" aria-hidden="true" draggable="false" />
                        <img className="glitch-camada glitch-magenta" src={midiaAtiva.src} alt="" aria-hidden="true" draggable="false" />
                      </>
                    )}
                  </>
                ) : videoAtivoId === midiaAtiva.videoId ? (
                  <iframe
                    key={midiaAtiva.videoId}
                    className="obra-video-player"
                    src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(midiaAtiva.videoId)}?autoplay=1&controls=1&playsinline=1`}
                    title={midiaAtiva.titulo || `Vídeo de ${titulo}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <button
                    ref={imagemRef}
                    type="button"
                    className="obra-video-trigger"
                    aria-label={`Reproduzir vídeo ${midiaAtiva.titulo || titulo}`}
                    onClick={() => modoGrade ? void abrirFoco() : setVideoAtivoId(midiaAtiva.videoId)}
                  >
                    <img
                      src={miniaturaDoVideo(midiaAtiva)}
                      onError={event => falhaNaMiniatura(event, midiaAtiva)}
                      alt={`Miniatura do vídeo ${midiaAtiva.titulo || titulo}`}
                      loading={modoGrade && indiceGrade < 6 ? "eager" : "lazy"}
                      decoding="async"
                    />
                    <span className="obra-video-play" aria-hidden="true">▶</span>
                    <span className="obra-video-legenda">ASSISTIR VÍDEO</span>
                  </button>
                )}
                {tipoDeArte === 'glitch' && midiaAtiva.tipo === 'youtube' && (
                  <>
                    <img className="glitch-camada glitch-ciano" src={miniaturaDoVideo(midiaAtiva)} alt="" aria-hidden="true" draggable="false" />
                    <img className="glitch-camada glitch-magenta" src={miniaturaDoVideo(midiaAtiva)} alt="" aria-hidden="true" draggable="false" />
                  </>
                )}
              </>
            ) : <span>Imagem da obra</span>}
            {midias.length > 1 && (
              <>
                <span className="carrossel-indice">
                  <span>VISTA</span>
                  {String(indiceImagem + 1).padStart(2, '0')}
                  <i aria-hidden="true">/</i>
                  {String(midias.length).padStart(2, '0')}
                </span>
                <button
                  type="button"
                  className="carrossel-seta carrossel-anterior"
                  aria-label={`Imagem anterior de ${titulo}`}
                  onClick={() => navegarImagem(-1)}
                >
                  <span aria-hidden="true">←</span>
                </button>
                <button
                  type="button"
                  className="carrossel-seta carrossel-proxima"
                  aria-label={`Próxima imagem de ${titulo}`}
                  onClick={() => navegarImagem(1)}
                >
                  <span aria-hidden="true">→</span>
                </button>
                {modoGrade && (
                  <span className="grade-midia-contagem" aria-label={`${midias.length - 1} mídias adicionais`}>
                    +{midias.length - 1} {midias.length === 2 ? 'imagem' : 'imagens'}
                  </span>
                )}
              </>
            )}
          </div>
          {midias.length > 1 && !modoGrade && (
            <div className="carrossel-miniaturas" role="group" aria-label={`Escolher imagem ou vídeo de ${titulo}`}>
              {midias.map((midia, index) => (
                <button
                  type="button"
                  key={`${midia.tipo}-${midia.src || midia.videoId}-${index}`}
                  className={index === indiceImagem ? 'ativa' : ''}
                  aria-label={`Mostrar ${midia.tipo === 'youtube' ? 'vídeo' : 'imagem'} ${index + 1} de ${titulo}`}
                  aria-current={index === indiceImagem ? 'true' : undefined}
                  onClick={() => selecionarMiniatura(index)}
                >
                  <img
                    src={midia.tipo === 'youtube' ? miniaturaDoVideo(midia) : midia.src}
                    onError={midia.tipo === 'youtube' ? event => falhaNaMiniatura(event, midia) : undefined}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  {midia.tipo === 'youtube' && <i aria-hidden="true">▶</i>}
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </button>
              ))}
              <span className="carrossel-arraste" aria-hidden="true">↔</span>
            </div>
          )}
        </div>
        <div
          className="obra-texto"
          onMouseEnter={abrirDetalhesNoHover}
          onMouseLeave={fecharDetalhesForaDoHover}
        >
          {!modoGrade && <span className="categoria-legenda">{categoriaNome}</span>}
          <h3>{titulo}</h3>
          {descricao && <p style={{ whiteSpace: 'pre-line' }}>{descricao}</p>}

          <div className={`detalhe-wrapper ${expandido ? 'aberto' : ''}`}>
            <div className="detalhe-inner">
              {detalhe && <p className="detalhe" style={{ whiteSpace: 'pre-line' }}>{detalhe}</p>}
              {valoresTecnicos.length > 0 && <dl className="obra-ficha-tecnica">{valoresTecnicos.map(([rotulo, valor]) => <div className="obra-ficha-item" key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></div>)}</dl>}
            </div>
          </div>

          {temDetalhes && (
            <button
              type="button"
              className="obra-detalhe-botao"
              aria-expanded={expandido}
              onClick={alternarDetalhes}
            >
              {expandido ? 'Fechar detalhes' : 'Explorar detalhes e ficha técnica'}
              <span aria-hidden="true">{expandido ? '−' : '+'}</span>
            </button>
          )}
        </div>
      </article>
      <dialog
        ref={dialogRef}
        className={`obra-focus ${focoFechando ? 'fechando' : ''} ${midiaAtiva?.tipo === 'youtube' ? 'obra-focus-com-video' : ''} ${(descricao?.length || 0) + (detalhe?.length || 0) > 220 ? 'obra-focus-texto-longo' : ''}`}
        aria-label={`Visualização ampliada de ${titulo}`}
        onCancel={event => {
          event.preventDefault()
          void fecharFoco()
        }}
        onClick={event => {
          if (event.target === dialogRef.current || event.target.classList.contains('obra-focus-stage')) {
            void fecharFoco()
          }
        }}
      >
        <div className="obra-focus-stage">
          <button type="button" className="obra-focus-fechar" aria-label="Fechar visualização" onClick={() => void fecharFoco()}>
            <span aria-hidden="true">×</span>
          </button>
          {indicesImagem.length > 1 && (
            <>
              <button
                type="button"
                className="obra-focus-seta obra-focus-anterior"
                aria-label={`Imagem anterior de ${titulo}`}
                onClick={() => navegarImagemFoco(-1)}
              >
                <span aria-hidden="true">←</span>
              </button>
              <button
                type="button"
                className="obra-focus-seta obra-focus-proxima"
                aria-label={`Próxima imagem de ${titulo}`}
                onClick={() => navegarImagemFoco(1)}
              >
                <span aria-hidden="true">→</span>
              </button>
              <span className="obra-focus-contagem" aria-live="polite">
                {String(indicesImagem.indexOf(indiceImagem) + 1).padStart(2, '0')} <i aria-hidden="true">/</i> {String(indicesImagem.length).padStart(2, '0')}
              </span>
            </>
          )}
          <div className={`obra-focus-media ${midiaAtiva?.tipo === 'youtube' ? 'tem-video' : ''}`}>
            {videoFocoAtivo && midiaAtiva?.tipo === 'youtube' ? (
              <iframe
                className="obra-focus-video"
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(midiaAtiva.videoId)}?autoplay=1&controls=1&playsinline=1`}
                title={midiaAtiva.titulo || `Vídeo de ${titulo}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <img
                ref={imagemFocoRef}
                className="obra-focus-imagem"
                src={focoPreparado ? (midiaAtiva?.src || midiaAtiva?.miniatura) : undefined}
                alt={`${titulo} — visualização ampliada`}
                draggable="false"
                onPointerDown={iniciarArrasteFoco}
                onPointerUp={finalizarArrasteFoco}
                onPointerCancel={() => { inicioArrasteFocoRef.current = null }}
              />
            )}
            {midiaAtiva?.tipo === 'youtube' && !videoFocoAtivo && (
              <button
                type="button"
                className="obra-focus-video-play"
                aria-label={`Assistir vídeo: ${titulo}`}
                onClick={() => setVideoFocoAtivo(true)}
              >
                <span aria-hidden="true">▶</span>
                <span>Assistir vídeo</span>
              </button>
            )}
          </div>
          <div className="obra-focus-caption">
            <span>{categoriaNome}</span>
            <h2>{titulo}</h2>
            {descricao && <p>{descricao}</p>}
            {detalhe && <p className="obra-focus-detalhe">{detalhe}</p>}
            {valoresTecnicos.length > 0 && <dl className="obra-focus-ficha">{valoresTecnicos.map(([rotulo, valor]) => <div key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></div>)}</dl>}
          </div>
        </div>
      </dialog>
    </>
  )
}