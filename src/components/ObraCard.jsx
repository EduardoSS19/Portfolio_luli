import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useScrollReveal } from '../hooks/useScrollReveal.js'
import { useCardEmFoco } from '../hooks/useCardEmFoco.js'

let motionModule

function carregarMotion() {
  motionModule ??= import('https://cdn.jsdelivr.net/npm/motion@12.23.24/+esm')
  return motionModule
}

const EASE_ABRIR = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EASE_FECHAR = 'cubic-bezier(0.4, 0, 0.2, 1)'
const SEM_RECORTE = 'inset(0px 0px 0px 0px)'
const SEM_TRANSFORMACAO = 'translate(0px, 0px) scale(1)'

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
  categoria,
  categoriaNome,
  tipoDeArte = 'obra',
  invertido,
}) {
  const [expandido, setExpandido] = useState(false)
  const [indiceImagem, setIndiceImagem] = useState(0)
  const [direcao, setDirecao] = useState(1)
  const [focoAberto, setFocoAberto] = useState(false)
  const [focoFechando, setFocoFechando] = useState(false)
  const [videoAtivoId, setVideoAtivoId] = useState(null)
  const [focoPreparado, setFocoPreparado] = useState(false)
  const [ref, visivel] = useScrollReveal()
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
  const detalhesPendentesRef = useRef(false)
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

  function centralizarCard(ajusteAltura = 0) {
    const card = ref.current
    if (!card) return false

    const rect = card.getBoundingClientRect()
    const centroPrevisto = rect.top + (rect.height + ajusteAltura) / 2
    const destino = window.scrollY + centroPrevisto - window.innerHeight / 2
    const maximo = document.documentElement.scrollHeight - window.innerHeight
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    const destinoLimitado = Math.max(0, Math.min(destino, maximo))
    const precisaRolar = Math.abs(window.scrollY - destinoLimitado) > 2
    if (precisaRolar) window.scrollTo({ top: destinoLimitado, behavior })
    return precisaRolar
  }

  function centralizarAoClicarCard(event) {
    if (event.target.closest('.obra-zoom-trigger, .obra-video-trigger, .obra-detalhe-botao')) return
    centralizarCard()
  }

  function abrirDetalhesNoHover() {
    if (!detalhe || detalhesFixadosRef.current !== null || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    setExpandido(true)
  }

  function fecharDetalhesForaDoHover() {
    if (!detalhe || detalhesFixadosRef.current !== null || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    setExpandido(false)
  }

  function aguardarFimDoScroll() {
    return new Promise(resolve => {
      let quietTimer
      let timeout
      let resolvido = false

      function finalizar() {
        if (resolvido) return
        resolvido = true
        window.clearTimeout(quietTimer)
        window.clearTimeout(timeout)
        window.removeEventListener('scroll', aoRolar)
        resolve()
      }

      function aoRolar() {
        window.clearTimeout(quietTimer)
        quietTimer = window.setTimeout(finalizar, 120)
      }

      window.addEventListener('scroll', aoRolar, { passive: true })
      quietTimer = window.setTimeout(finalizar, 150)
      timeout = window.setTimeout(finalizar, 1400)
    })
  }

  async function abrirFoco() {
    const dialog = dialogRef.current
    if (!dialog || dialog.open || focoFechandoRef.current) return

    focoPendenteRef.current = false
    // A imagem grande só começa a carregar no primeiro uso (ou ao passar o mouse).
    flushSync(() => setFocoPreparado(true))

    const imagemFoco = imagemFocoRef.current
    if (imagemFoco) {
      await Promise.race([imagemFoco.decode().catch(() => {}), esperar(1500)])
    }
    if (dialog.open || focoFechandoRef.current) return

    overflowAnteriorRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Esconde a miniatura e abre o dialog no mesmo quadro: sem piscar e sem teletransporte.
    flushSync(() => setFocoAberto(true))
    dialog.showModal()

    const miniatura = imagemRef.current
    if (!imagemFoco || !miniatura || reduzirMovimento()) return
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
    if (!dialog?.open || focoFechandoRef.current || focoAbrindoRef.current) return

    focoFechandoRef.current = true
    setFocoFechando(true)

    const imagemFoco = imagemFocoRef.current
    const miniatura = imagemRef.current
    const quadro = imagemFoco && miniatura && !reduzirMovimento()
      ? calcularQuadroDaMiniatura(imagemFoco, miniatura)
      : null

    let animacao = null
    if (quadro) {
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
    dialog.close()
    animacao?.cancel()
    document.body.style.overflow = overflowAnteriorRef.current
    setFocoFechando(false)
    focoFechandoRef.current = false
    imagemRef.current?.focus({ preventScroll: true })
  }

  async function alternarDetalhes() {
    if (detalhesPendentesRef.current) return
    detalhesPendentesRef.current = true

    const novoEstado = !expandido
    detalhesFixadosRef.current = novoEstado
    const conteudoDetalhe = ref.current?.querySelector('.detalhe-inner')
    const alturaDetalhe = conteudoDetalhe?.scrollHeight ?? 0
    const ajusteAltura = novoEstado ? alturaDetalhe : -alturaDetalhe
    const precisaRolar = centralizarCard(ajusteAltura)

    if (precisaRolar && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await aguardarFimDoScroll()
    }

    setExpandido(novoEstado)
    detalhesPendentesRef.current = false
  }

  async function focarImagem(event) {
    if (midiaAtiva?.tipo !== 'imagem') return
    if (arrasteConcluidoRef.current) {
      arrasteConcluidoRef.current = false
      return
    }
    event.preventDefault()
    if (focoPendenteRef.current || dialogRef.current?.open) return
    focoPendenteRef.current = true
    centralizarCard()
    await aguardarFimDoScroll()
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
    inicioArrasteFocoRef.current = event.clientX
  }

  function finalizarArrasteFoco(event) {
    if (inicioArrasteFocoRef.current === null) return
    const distancia = event.clientX - inicioArrasteFocoRef.current
    inicioArrasteFocoRef.current = null
    if (Math.abs(distancia) > 42 && indicesImagem.length > 1) {
      navegarImagemFoco(distancia < 0 ? 1 : -1)
    }
  }

  useEffect(() => {
    if (!imagemRef.current) return
    if (animacaoInicialRef.current) {
      animacaoInicialRef.current = false
      return
    }

    let cancelada = false
    carregarMotion()
      .then(({ animate }) => {
        if (!cancelada && imagemRef.current) {
          animate(
            imagemRef.current,
            { opacity: [0.35, 1], x: [direcao * 26, 0], scale: [1.035, 1] },
            { duration: 0.48, ease: [0.22, 1, 0.36, 1] },
          )
        }
      })
      .catch(error => {
        console.warn('Não foi possível carregar as animações do Motion CDN.', error)
      })

    return () => { cancelada = true }
  }, [indiceImagem, direcao])

  useEffect(() => () => {
    if (dialogRef.current?.open) dialogRef.current.close()
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
        className={`obra arte-${tipoDeArte} categoria-${categoria} ${visivel ? 'visivel' : ''} ${emFoco ? 'em-foco' : ''} ${invertido ? 'invertido' : ''} ${focoAberto ? 'foco-ativo' : ''}`}
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
                        src={midiaAtiva.src}
                        alt={`${titulo} — imagem ${indicesImagem.indexOf(indiceImagem) + 1} de ${indicesImagem.length}`}
                        loading="lazy"
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
                    src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(midiaAtiva.videoId)}?autoplay=1`}
                    title={midiaAtiva.titulo || `Vídeo de ${titulo}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <button
                    type="button"
                    className="obra-video-trigger"
                    aria-label={`Reproduzir vídeo ${midiaAtiva.titulo || titulo}`}
                    onClick={() => setVideoAtivoId(midiaAtiva.videoId)}
                  >
                    <img
                      src={midiaAtiva.miniatura}
                      alt={`Miniatura do vídeo ${midiaAtiva.titulo || titulo}`}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="obra-video-play" aria-hidden="true">▶</span>
                    <span className="obra-video-legenda">ASSISTIR VÍDEO</span>
                  </button>
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
              </>
            )}
          </div>
          {midias.length > 1 && (
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
                  <img src={midia.tipo === 'youtube' ? midia.miniatura : midia.src} alt="" loading="lazy" decoding="async" />
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
          <span className="categoria-legenda">{categoriaNome}</span>
          <h3>{titulo}</h3>
          {descricao && <p>{descricao}</p>}

          <div className={`detalhe-wrapper ${expandido ? 'aberto' : ''}`}>
            <div className="detalhe-inner">
              {detalhe && <p className="detalhe">{detalhe}</p>}
            </div>
          </div>

          {detalhe && (
            <button
              type="button"
              className="obra-detalhe-botao"
              aria-expanded={expandido}
              onClick={alternarDetalhes}
            >
              {expandido ? 'Fechar detalhes' : 'Explorar detalhes'}
              <span aria-hidden="true">{expandido ? '−' : '+'}</span>
            </button>
          )}
        </div>
      </article>
      <dialog
        ref={dialogRef}
        className={`obra-focus ${focoFechando ? 'fechando' : ''}`}
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
          <img
            ref={imagemFocoRef}
            className="obra-focus-imagem"
            src={focoPreparado ? midiaAtiva?.src : undefined}
            alt={`${titulo} — visualização ampliada`}
            draggable="false"
            onPointerDown={iniciarArrasteFoco}
            onPointerUp={finalizarArrasteFoco}
            onPointerCancel={() => { inicioArrasteFocoRef.current = null }}
          />
        </div>
      </dialog>
    </>
  )
}