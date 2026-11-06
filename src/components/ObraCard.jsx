import { useEffect, useRef, useState } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal.js'

let motionModule

function carregarMotion() {
  motionModule ??= import('https://cdn.jsdelivr.net/npm/motion@12.23.24/+esm')
  return motionModule
}

export function ObraCard({
  titulo,
  imagem,
  imagens: imagensDaObra = [],
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
  const [ref, visivel] = useScrollReveal()
  const imagemRef = useRef(null)
  const dialogRef = useRef(null)
  const imagemFocoRef = useRef(null)
  const animacaoInicialRef = useRef(true)
  const inicioArrasteRef = useRef(null)
  const arrasteConcluidoRef = useRef(false)
  const inicioArrasteFocoRef = useRef(null)
  const focoPendenteRef = useRef(false)
  const focoFechandoRef = useRef(false)
  const detalhesPendentesRef = useRef(false)
  const detalhesFixadosRef = useRef(null)
  const overflowAnteriorRef = useRef('')
  const imagens = imagensDaObra.length ? imagensDaObra : imagem ? [imagem] : []

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
    if (event.target.closest('.obra-zoom-trigger, .obra-detalhe-botao')) return
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

  async function animarFoco(abrindo) {
    const imagemFoco = imagemFocoRef.current
    const imagemOrigem = imagemRef.current
    if (!imagemFoco || !imagemOrigem || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const origem = imagemOrigem.getBoundingClientRect()
    const destino = imagemFoco.getBoundingClientRect()
    const escala = Math.min(origem.width / destino.width, origem.height / destino.height)
    const x = origem.left + origem.width / 2 - (destino.left + destino.width / 2)
    const y = origem.top + origem.height / 2 - (destino.top + destino.height / 2)

    try {
      const { animate } = await carregarMotion()
      const animacao = animate(
        imagemFoco,
        abrindo ? { x: [x, 0], y: [y, 0], scale: [escala, 1] } : { x, y, scale: escala },
        { duration: abrindo ? 0.62 : 0.48, ease: [0.22, 1, 0.36, 1] },
      )
      await Promise.race([
        animacao.finished.catch(() => {}),
        new Promise(resolve => window.setTimeout(resolve, 700)),
      ])
    } catch (error) {
      console.warn('Não foi possível animar o foco da obra.', error)
    }
  }

  async function abrirFoco() {
    const dialog = dialogRef.current
    if (!dialog || dialog.open || focoFechandoRef.current) return

    focoPendenteRef.current = false
    overflowAnteriorRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    setFocoAberto(true)
    window.requestAnimationFrame(() => { void animarFoco(true) })
  }

  async function fecharFoco() {
    const dialog = dialogRef.current
    if (!dialog?.open || focoFechandoRef.current) return

    focoFechandoRef.current = true
    setFocoFechando(true)
    await animarFoco(false)
    dialog.close()
    document.body.style.overflow = overflowAnteriorRef.current
    setFocoAberto(false)
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
    setIndiceImagem(indiceAtual => (indiceAtual + direcao + imagens.length) % imagens.length)
  }

  function iniciarArrasteFoco(event) {
    inicioArrasteFocoRef.current = event.clientX
  }

  function finalizarArrasteFoco(event) {
    if (inicioArrasteFocoRef.current === null) return
    const distancia = event.clientX - inicioArrasteFocoRef.current
    inicioArrasteFocoRef.current = null
    if (Math.abs(distancia) > 42 && imagens.length > 1) {
      navegarImagem(distancia < 0 ? 1 : -1)
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
    setIndiceImagem(indice)
  }

  function iniciarArraste(event) {
    if (imagens.length < 2 || event.target.closest('.carrossel-seta, .carrossel-indice')) return
    arrasteConcluidoRef.current = false
    inicioArrasteRef.current = { x: event.clientX, y: event.clientY }
    if (event.target instanceof Element && 'setPointerCapture' in event.target) {
      event.target.setPointerCapture(event.pointerId)
    }
  }

  function finalizarArraste(event) {
    if (imagens.length < 2 || inicioArrasteRef.current === null) return
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
        className={`obra arte-${tipoDeArte} categoria-${categoria} ${visivel ? 'visivel' : ''} ${invertido ? 'invertido' : ''} ${focoAberto ? 'foco-ativo' : ''}`}
        onClick={centralizarAoClicarCard}
      >
        <div className="obra-galeria">
          <div
            className={`obra-imagem ${imagens.length ? '' : 'obra-imagem-placeholder'} ${imagens.length > 1 ? 'tem-carrossel' : ''}`}
            onPointerDown={imagens.length > 1 ? iniciarArraste : undefined}
            onPointerUp={imagens.length > 1 ? finalizarArraste : undefined}
            onPointerCancel={imagens.length > 1 ? () => { inicioArrasteRef.current = null } : undefined}
            onLostPointerCapture={imagens.length > 1 ? () => { inicioArrasteRef.current = null } : undefined}
          >
            {imagens.length ? (
              <>
                <button
                  ref={imagemRef}
                  type="button"
                  className="obra-zoom-trigger"
                  aria-label={`Ampliar obra ${titulo}, imagem ${indiceImagem + 1} de ${imagens.length}`}
                  onClick={focarImagem}
                >
                  <img
                    key={imagens[indiceImagem]}
                    src={imagens[indiceImagem]}
                    alt={`${titulo} — imagem ${indiceImagem + 1} de ${imagens.length}`}
                    loading="lazy"
                    decoding="async"
                    draggable="false"
                  />
                  <span className="obra-zoom-label" aria-hidden="true">↗</span>
                </button>
                {tipoDeArte === 'glitch' && (
                  <>
                    <img className="glitch-camada glitch-ciano" src={imagens[indiceImagem]} alt="" aria-hidden="true" draggable="false" />
                    <img className="glitch-camada glitch-magenta" src={imagens[indiceImagem]} alt="" aria-hidden="true" draggable="false" />
                  </>
                )}
              </>
            ) : <span>Imagem da obra</span>}
            {imagens.length > 1 && (
              <>
                <span className="carrossel-indice">
                  <span>VISTA</span>
                  {String(indiceImagem + 1).padStart(2, '0')}
                  <i aria-hidden="true">/</i>
                  {String(imagens.length).padStart(2, '0')}
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
          {imagens.length > 1 && (
            <div className="carrossel-miniaturas" role="group" aria-label={`Escolher imagem de ${titulo}`}>
              {imagens.map((src, index) => (
                <button
                  type="button"
                  key={`${src}-${index}`}
                  className={index === indiceImagem ? 'ativa' : ''}
                  aria-label={`Mostrar imagem ${index + 1} de ${titulo}`}
                  aria-current={index === indiceImagem ? 'true' : undefined}
                  onClick={() => selecionarMiniatura(index)}
                >
                  <img src={src} alt="" loading="lazy" decoding="async" />
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
          {imagens.length > 1 && (
            <>
              <button
                type="button"
                className="obra-focus-seta obra-focus-anterior"
                aria-label={`Imagem anterior de ${titulo}`}
                onClick={() => navegarImagem(-1)}
              >
                <span aria-hidden="true">←</span>
              </button>
              <button
                type="button"
                className="obra-focus-seta obra-focus-proxima"
                aria-label={`Próxima imagem de ${titulo}`}
                onClick={() => navegarImagem(1)}
              >
                <span aria-hidden="true">→</span>
              </button>
              <span className="obra-focus-contagem" aria-live="polite">
                {String(indiceImagem + 1).padStart(2, '0')} <i aria-hidden="true">/</i> {String(imagens.length).padStart(2, '0')}
              </span>
            </>
          )}
          <img
            ref={imagemFocoRef}
            className="obra-focus-imagem"
            src={imagens[indiceImagem]}
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