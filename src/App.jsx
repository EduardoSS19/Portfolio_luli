import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react'
import { FundoFantasma } from './components/FundoFantasma.jsx'
import { Hero } from './components/Hero.jsx'
import { Nav } from './components/Nav.jsx'
import { Sobre } from './components/Sobre.jsx'
import { SecaoCategoria } from './components/SecaoCategoria.jsx'
import { GaleriaGrade } from './components/GaleriaGrade.jsx'
import { Referencias } from './components/Referencias.jsx'
import { Footer } from './components/Footer.jsx'
import { useSecaoAtiva } from './hooks/useSecaoAtiva.js'
import { Contato } from './components/Contato.jsx'

const perfilInicial = {
  nome: 'Nome da artista',
  frase: 'Arte · Pesquisa · Experimentação',
  foto: '',
  bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  instagram: '',
  email: '',
  formulario: '',
}

export default function App() {
  const [conteudo, setConteudo] = useState({
    categorias: [],
    referencias: [],
    frames: [],
    redes: [],
    sobre: null,
  })
  const [carregando, setCarregando] = useState(true)
  const [previsualizacao, setPrevisualizacao] = useState(null)
  const categorias = conteudo.categorias
  const referencias = conteudo.referencias
  const sobre = conteudo.sobre ?? perfilInicial
  const [modoGaleria, setModoGaleria] = useState('lista')
  const secoesNav = useMemo(() => [
    { titulo: 'Início', chave: 'inicio' },
    ...categorias.map(c => ({ titulo: c.titulo, chave: c.chave })),
    ...(referencias.length ? [{ titulo: 'Referências', chave: 'referencias' }] : []),
    { titulo: 'Contato', chave: 'contato' },
  ], [categorias, referencias.length])
  const secaoAtiva = useSecaoAtiva(secoesNav, modoGaleria)
  const [animando, setAnimando] = useState(null)
  const [mostrarVoltarTopo, setMostrarVoltarTopo] = useState(false)
  const anteriorRef = useRef(secaoAtiva)
  const trocaModoPendenteRef = useRef(null)

  function trocarModoGaleria(novoModo) {
    if (novoModo === modoGaleria) return
    const cards = [...document.querySelectorAll('.galeria-grade-global .obra, .secao .obra')]
    const centro = window.innerHeight / 2
    const cardAtual = cards
      .map(card => ({ card, rect: card.getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom > 0 && rect.top < window.innerHeight)
      .sort((a, b) => Math.abs((a.rect.top + a.rect.height / 2) - centro) - Math.abs((b.rect.top + b.rect.height / 2) - centro))[0]
    trocaModoPendenteRef.current = cardAtual?.card.dataset.obraChave
      ? { chave: cardAtual.card.dataset.obraChave, topo: cardAtual.rect.top }
      : null
    setModoGaleria(novoModo)
  }

  useLayoutEffect(() => {
    const pendente = trocaModoPendenteRef.current
    if (!pendente) return
    const card = [...document.querySelectorAll('.galeria-grade-global .obra, .secao .obra')]
      .find(item => item.dataset.obraChave === pendente.chave)
    if (card) {
      const novoTopo = card.getBoundingClientRect().top
      window.scrollBy({ top: novoTopo - pendente.topo, behavior: 'auto' })
    }
    trocaModoPendenteRef.current = null
  }, [modoGaleria])

  useEffect(() => {
    function atualizarBotaoTopo() {
      setMostrarVoltarTopo(window.scrollY > 560)
    }

    atualizarBotaoTopo()
    window.addEventListener('scroll', atualizarBotaoTopo, { passive: true })
    return () => window.removeEventListener('scroll', atualizarBotaoTopo)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const previewToken = new URLSearchParams(window.location.search).get('preview_token')
    const apiUrl = previewToken
      ? `/api/portfolio/?preview_token=${encodeURIComponent(previewToken)}`
      : '/api/portfolio/'

    fetch(apiUrl, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`API respondeu ${response.status}`)
        return response.json()
      })
      .then(data => {
        setConteudo(atual => ({
          categorias: Array.isArray(data.categorias) ? data.categorias : [],
          referencias: Array.isArray(data.referencias) ? data.referencias : [],
          frames: Array.isArray(data.frames) ? data.frames : [],
          redes: Array.isArray(data.redes) ? data.redes : [],
          sobre: data.sobre && typeof data.sobre.bio === 'string' ? data.sobre : null,
        }))
        setPrevisualizacao(data.preview ?? null)
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.warn('Não foi possível carregar o conteúdo do Django.', error)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false)
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (secaoAtiva !== anteriorRef.current) {
      const sec = secoesNav.find(s => s.titulo === secaoAtiva)
      anteriorRef.current = secaoAtiva
      if (sec) {
        setAnimando(sec.chave)
        const timer = setTimeout(() => setAnimando(null), 1000)
        return () => clearTimeout(timer)
      }
    }
  }, [secaoAtiva])

  function selecionarCategoria(titulo) {
    const secao = document.getElementById(titulo)
    if (secao) {
      secao.scrollIntoView({ behavior: 'smooth' })
      return
    }
    const categoria = categorias.find(item => item.titulo === titulo)
    const primeiraObra = categoria && [...document.querySelectorAll('.galeria-grade-global .obra')]
      .find(card => card.classList.contains(`categoria-${categoria.chave}`))
    primeiraObra?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function voltarAoTopo() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, 0)
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (carregando) {
    return (
      <div className="carregando" role="status" aria-live="polite">
        <span className="carregando-anel" aria-hidden="true" />
        <span className="carregando-texto">Carregando</span>
      </div>
    )
  }

  return (
    <div className="site-shell">
      {previsualizacao && (
        <div className="preview-mode-banner" role="status">
          Prévia privada · {previsualizacao.titulo} · somente você pode visualizar este rascunho
        </div>
      )}
      <FundoFantasma frames={conteudo.frames} />
      <Hero nome={sobre.nome} frase={sobre.frase} />
      <Nav
        categorias={secoesNav}
        categoriaAtiva={secaoAtiva}
        animando={animando}
        aoSelecionar={selecionarCategoria}
        modoGaleria={modoGaleria}
        aoTrocarModo={trocarModoGaleria}
      />
      <Sobre perfil={sobre} />
      {modoGaleria === 'grade' ? (
        <GaleriaGrade categorias={categorias} />
      ) : (
        categorias.map((cat, indice) => (
          <SecaoCategoria
            key={cat.titulo}
            titulo={cat.titulo}
            chave={cat.chave}
            obras={cat.obras}
            indice={indice}
          />
        ))
      )}
      {referencias.length > 0 && <Referencias referencias={referencias} />}
      <Contato endpoint={sobre.formulario} email={sobre.email} />
      <Footer nome={sobre.nome} instagram={sobre.instagram} email={sobre.email} redes={conteudo.redes} />
      <button
        type="button"
        className={`voltar-topo ${mostrarVoltarTopo ? 'visivel' : ''}`}
        aria-label="Voltar ao topo"
        onClick={voltarAoTopo}
        tabIndex={mostrarVoltarTopo ? 0 : -1}
        aria-hidden={!mostrarVoltarTopo}
      >
        <span aria-hidden="true">↑</span>
      </button>
    </div>
  )
}