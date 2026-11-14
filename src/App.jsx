import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react'
import { FundoFantasma } from './components/FundoFantasma.jsx'
import { Hero } from './components/Hero.jsx'
import { Nav } from './components/Nav.jsx'
import { Sobre } from './components/Sobre.jsx'
import { SecaoCategoria } from './components/SecaoCategoria.jsx'
import { GaleriaGrade } from './components/GaleriaGrade.jsx'
import { GaleriaGradeDiagnostico } from './components/GaleriaGradeDiagnostico.jsx'
import { Referencias } from './components/Referencias.jsx'
import { Footer } from './components/Footer.jsx'
import { useSecaoAtiva } from './hooks/useSecaoAtiva.js'
import { Contato } from './components/Contato.jsx'
import { trackAnalyticsEvent } from './utils/analytics.js'
import { CmsPage } from './cms/CmsPage.jsx'

const DEFAULT_LAYOUT_SETTINGS = {
  content_width: 'standard',
  hero_alignment: 'center',
  hero_size: 'large',
  section_spacing: 'comfortable',
  gallery_columns: '3',
  default_gallery_view: 'lista',
  default_theme: 'escuro',
  dark_color_background: '#061522',
  dark_color_surface: '#0b2943',
  dark_color_text: '#eff7ff',
  dark_color_muted: '#a9bdcc',
  dark_color_accent: '#93c8f2',
  light_color_background: '#f5f2eb',
  light_color_surface: '#ffffff',
  light_color_text: '#24231f',
  light_color_muted: '#77746c',
  light_color_accent: '#657c62',
  show_bio_image: true,
  show_bio: true,
  show_references: true,
}

const LAYOUT_PREVIEW_CHOICES = {
  content_width: ['compact', 'standard', 'wide'],
  hero_alignment: ['center', 'left'],
  hero_size: ['compact', 'large'],
  section_spacing: ['compact', 'comfortable', 'spacious'],
  gallery_columns: ['2', '3', '4'],
  default_gallery_view: ['lista', 'grade'],
  default_theme: ['escuro', 'claro'],
}
const LAYOUT_PREVIEW_COLORS = ['dark_color_background','dark_color_surface','dark_color_text','dark_color_muted','dark_color_accent','light_color_background','light_color_surface','light_color_text','light_color_muted','light_color_accent']

function parseLayoutPreview(raw) {
  try {
    const candidate = JSON.parse(raw)
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
    const safe = {}
    Object.entries(LAYOUT_PREVIEW_CHOICES).forEach(([key, choices]) => {
      if (choices.includes(candidate[key])) safe[key] = candidate[key]
    })
    LAYOUT_PREVIEW_COLORS.forEach(key => {
      if (typeof candidate[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(candidate[key])) safe[key] = candidate[key].toLowerCase()
    })
    ;['show_bio_image','show_bio','show_references'].forEach(key => {
      if (typeof candidate[key] === 'boolean') safe[key] = candidate[key]
    })
    return safe
  } catch {
    return null
  }
}

function colorLuminance(hex){
  const channels=hex.replace('#','').match(/.{2}/g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4)
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722
}
function colorContrast(a,b){
  const values=[colorLuminance(a),colorLuminance(b)].sort((x,y)=>y-x)
  return(values[0]+.05)/(values[1]+.05)
}
function blendColor(from,to,amount){
  const a=from.match(/[0-9a-f]{2}/gi).map(value=>parseInt(value,16))
  const b=to.match(/[0-9a-f]{2}/gi).map(value=>parseInt(value,16))
  return '#'+a.map((value,index)=>Math.round(value+(b[index]-value)*amount).toString(16).padStart(2,'0')).join('')
}
function accessibleColor(foreground,background,minimum=4.5){
  if(!foreground||!background||colorContrast(foreground,background)>=minimum)return foreground
  const target=colorContrast('#000000',background)>=colorContrast('#ffffff',background)?'#000000':'#ffffff'
  let low=0,high=1
  for(let step=0;step<22;step++){
    const middle=(low+high)/2
    if(colorContrast(blendColor(foreground,target,middle),background)>=minimum)high=middle
    else low=middle
  }
  return blendColor(foreground,target,high)
}


const LAYOUT_PREVIEW_DEMO = {
  categorias: [
    { titulo: 'Pintura e experimentação', chave: 'pintura-experimentacao', animacao: 'obra', obras: [
      { titulo: 'Estudo de luz I', imagem: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1400&q=85', descricao: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Uma composição de cores, gestos e camadas.', detalhe: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', fichaTecnica: { tecnica: 'Acrílica sobre tela', material: 'Tinta acrílica e tela', ano: '2025', dimensoes: { altura: '60', largura: '80', unidade: 'cm' } } },
      { titulo: 'Matéria em suspensão', imagem: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1400&q=85', descricao: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', detalhe: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.' },
    ]},
    { titulo: 'Fotografia', chave: 'fotografia', animacao: 'fotografia', obras: [
      { titulo: 'Entre espaços', imagem: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=1400&q=85', descricao: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio.', detalhe: 'Praesent libero. Sed cursus ante dapibus diam.' },
      { titulo: 'Paisagem inventada', imagem: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1400&q=85', descricao: 'Sed nisi. Nulla quis sem at nibh elementum imperdiet.' },
    ]},
    { titulo: 'Desenho e gravura', chave: 'desenho-gravura', animacao: 'gravura', obras: [
      { titulo: 'Linhas de memória', imagem: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1400&q=85', descricao: 'Duis sagittis ipsum. Praesent mauris. Fusce nec tellus sed augue semper porta.', detalhe: 'Mauris massa. Vestibulum lacinia arcu eget nulla.' },
      { titulo: 'Pequenas narrativas', imagem: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1400&q=85', descricao: 'Curabitur sodales ligula in libero.' },
    ]},
  ],
  referencias: [
    { titulo: 'Exposição coletiva — Espaços possíveis', periodo: '2025 · Porto Alegre, Brasil', links: [{ texto: 'Descrição da exposição', url: '#referencia-teste-1' }, { texto: 'Registro fotográfico', url: '#referencia-teste-2' }] },
    { titulo: 'Residência artística — Laboratório de processos', periodo: '2024 · Projeto fictício para testes', links: [{ texto: 'Sobre o projeto', url: '#referencia-teste-3' }] },
    { titulo: 'Publicação — Caderno de experimentações', periodo: '2023 · Edição demonstrativa', links: [{ texto: 'Consultar publicação', url: '#referencia-teste-4' }] },
  ],
  sobre: { nome: 'Artista de demonstração', frase: 'Arte · Pesquisa · Experimentação', foto: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?w=900&q=85', bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\nSed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.', instagram: 'https://www.instagram.com/exemplo.artista', email: 'contato@artista-demo.example', formulario: 'https://example.com/contato' },
  frames: [],
  redes: [{ titulo: 'Instagram de demonstração', url: '#rede-teste' }],
}

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
    marca: '',
    layout: DEFAULT_LAYOUT_SETTINGS,
  })
  const [carregando, setCarregando] = useState(true)
  const [previsualizacao, setPrevisualizacao] = useState(null)
  const categorias = conteudo.categorias
  const referencias = conteudo.referencias
  const sobre = conteudo.sobre ?? perfilInicial
  const [modoGaleria, setModoGaleria] = useState(DEFAULT_LAYOUT_SETTINGS.default_gallery_view)
  // O portfólio sempre inicia no tema escuro; a escolha clara vale apenas para a sessão atual.
  const [tema, setTema] = useState(DEFAULT_LAYOUT_SETTINGS.default_theme)

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    document.documentElement.style.colorScheme = tema === 'claro' ? 'light' : 'dark'
  }, [tema])

  useEffect(() => {
    const layout = { ...DEFAULT_LAYOUT_SETTINGS, ...(conteudo.layout || {}) }
    const prefix = tema === 'claro' ? 'light' : 'dark'
    const background = layout[`${prefix}_color_background`]
    document.documentElement.style.setProperty('--layout-page-background', background)
    document.body.style.background = 'var(--layout-page-background)'
  }, [conteudo.layout, tema])
  const secoesNav = useMemo(() => [
    ...(conteudo.layout?.show_bio ?? true ? [{ titulo: 'Início', chave: 'inicio' }] : []),
    ...categorias.map(c => ({ titulo: c.titulo, chave: c.chave })),
    ...(referencias.length && (conteudo.layout?.show_references ?? true) ? [{ titulo: 'Referências', chave: 'referencias' }] : []),
    { titulo: 'Contato', chave: 'contato' },
  ], [categorias, referencias.length, conteudo.layout?.show_references, conteudo.layout?.show_bio_image, conteudo.layout?.show_bio])
  const [secaoAtiva, definirSecaoAtiva] = useSecaoAtiva(secoesNav, modoGaleria)
  const [animando, setAnimando] = useState(null)
  const [mostrarVoltarTopo, setMostrarVoltarTopo] = useState(false)
  const animacaoPendenteRef = useRef(null)
  const animacaoTimerRef = useRef(null)
  const trocaModoPendenteRef = useRef(null)
  const selecaoCategoriaTimerRef = useRef(null)
  const scrollEndHandlerRef = useRef(null)
  // Evita que atualizações visuais repetidas da prévia repitam a navegação até a mesma seção.
  const lastLayoutPreviewScrollTargetRef = useRef(null)

  function trocarModoGaleria(novoModo) {
    if (novoModo === modoGaleria) return
    trackAnalyticsEvent('gallery_view_change', { view_mode: novoModo })
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
    if (carregando || !new URLSearchParams(window.location.search).has('layout_preview')) return undefined
    const handleLayoutPreviewUpdate = event => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== 'cms-layout-preview:update') return
      const safeSettings = parseLayoutPreview(JSON.stringify(event.data.settings || {}))
      if (!safeSettings) return
      setConteudo(current => ({ ...current, layout: { ...current.layout, ...safeSettings } }))
      const previewMode = ['lista', 'grade'].includes(event.data.previewMode) ? event.data.previewMode : safeSettings.default_gallery_view
      if (previewMode) setModoGaleria(previewMode)
      if (safeSettings.default_theme) setTema(safeSettings.default_theme)
      const focus = event.data.focus
      const focusSelectors = {
        hero: '.hero',
        bio: '#Início',
        gallery: (previewMode || modoGaleria) === 'grade' ? '.galeria-grade-global' : '.secao:not(.sobre-secao):not(.secao-contato)',
        references: '#Referências',
        contact: '#Contato',
      }
      const selector = focusSelectors[focus]
      const scrollTarget = selector ? `${focus}:${selector}` : null
      // O editor envia mensagens também para atualizar cores e conteúdo. Só navegamos
      // quando o alvo muda; uma atualização do mesmo alvo nunca deve puxar a página de volta.
      // "page" e atualizações sem foco são apenas mudanças visuais; não apagam
      // o último destino visitado nem rearmam uma rolagem antiga.
      if (!scrollTarget) return
      if (lastLayoutPreviewScrollTargetRef.current === scrollTarget) return
      lastLayoutPreviewScrollTargetRef.current = scrollTarget
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (lastLayoutPreviewScrollTargetRef.current !== scrollTarget) return
        const target = document.querySelector(selector)
        if (!target) return
        target.scrollIntoView({ block: 'start', behavior: 'auto' })
      }))
    }
    window.addEventListener('message', handleLayoutPreviewUpdate)
    window.parent.postMessage({ type: 'cms-layout-preview:ready' }, window.location.origin)
    return () => window.removeEventListener('message', handleLayoutPreviewUpdate)
  }, [carregando])

  const initialLayoutPreviewFocusHandledRef = useRef(false)
  useEffect(() => {
    if (!carregando && !initialLayoutPreviewFocusHandledRef.current && new URLSearchParams(window.location.search).has('layout_preview')) {
      initialLayoutPreviewFocusHandledRef.current = true
      const focus = new URLSearchParams(window.location.search).get('layout_preview_focus')
      const selector = focus === 'hero' ? '.hero' : focus === 'gallery'
        ? (modoGaleria === 'grade' ? '.galeria-grade-global' : '.secao:not(.sobre-secao)')
        : null
      if (selector) {
        window.requestAnimationFrame(() => {
          document.querySelector(selector)?.scrollIntoView({ block: 'start', behavior: 'instant' })
        })
      }
    }
  }, [carregando, modoGaleria])

  useEffect(() => {
    function atualizarBotaoTopo() {
      setMostrarVoltarTopo(window.scrollY > 560)
    }

    atualizarBotaoTopo()
    window.addEventListener('scroll', atualizarBotaoTopo, { passive: true })
    return () => window.removeEventListener('scroll', atualizarBotaoTopo)
  }, [])

  useEffect(() => {
    if (window.location.pathname === '/painel' || window.location.pathname === '/painel/') {
      setCarregando(false)
      return undefined
    }

    const controller = new AbortController()

    const params = new URLSearchParams(window.location.search)
    const layoutPreview = params.has('layout_preview') ? parseLayoutPreview(params.get('layout_preview')) : null
    const previewToken = params.get('preview_token')
    const categoryPreviewToken = params.get('category_preview_token')
    const apiUrl = previewToken
      ? `/api/portfolio/?preview_token=${encodeURIComponent(previewToken)}`
      : categoryPreviewToken
        ? `/api/portfolio/?category_preview_token=${encodeURIComponent(categoryPreviewToken)}`
        : '/api/portfolio/'

    fetch(apiUrl, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`API respondeu ${response.status}`)
        return response.json()
      })
      .then(data => {
        const demoContent = params.has('layout_preview') ? LAYOUT_PREVIEW_DEMO : null
        setConteudo(atual => ({
          categorias: demoContent ? demoContent.categorias : Array.isArray(data.categorias) ? data.categorias : [],
          referencias: demoContent ? demoContent.referencias : Array.isArray(data.referencias) ? data.referencias : [],
          frames: demoContent ? demoContent.frames : Array.isArray(data.frames) ? data.frames : [],
          redes: demoContent ? demoContent.redes : Array.isArray(data.redes) ? data.redes : [],
          sobre: demoContent ? demoContent.sobre : data.sobre && typeof data.sobre.bio === 'string' ? data.sobre : null,
          marca: demoContent ? '' : data.marca || '',
          layout: { ...DEFAULT_LAYOUT_SETTINGS, ...(data.layout || {}), ...(layoutPreview || {}) },
        }))
        const layout = { ...DEFAULT_LAYOUT_SETTINGS, ...(data.layout || {}), ...(layoutPreview || {}) }
        setModoGaleria(layout.default_gallery_view)
        setTema(layout.default_theme)
        setPrevisualizacao(params.has('layout_preview') ? null : data.preview ?? null)
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

  function dispararAnimacaoCategoria(chave) {
    if (animacaoTimerRef.current) window.clearTimeout(animacaoTimerRef.current)
    setAnimando(chave)
    animacaoTimerRef.current = window.setTimeout(() => {
      setAnimando(atual => atual === chave ? null : atual)
      animacaoTimerRef.current = null
    }, 850)
  }

  // A seção ativa também muda durante a rolagem manual. Só animamos o título
  // quando a navegação foi solicitada explicitamente pelo menu e chegou ao destino.
  useEffect(() => {
    const pendente = animacaoPendenteRef.current
    if (!pendente || secaoAtiva !== pendente.titulo) return
    animacaoPendenteRef.current = null
    dispararAnimacaoCategoria(pendente.chave)
  }, [secaoAtiva])

  function selecionarCategoria(titulo) {
    // Cancela confirmações de navegações anteriores. Sem isso, cliques rápidos
    // podem deixar timeouts/scrollend antigos sobrescrevendo a categoria atual.
    if (selecaoCategoriaTimerRef.current) {
      window.clearTimeout(selecaoCategoriaTimerRef.current)
      selecaoCategoriaTimerRef.current = null
    }
    if (scrollEndHandlerRef.current) {
      window.removeEventListener('scrollend', scrollEndHandlerRef.current)
      scrollEndHandlerRef.current = null
    }

    // A seleção explícita deve refletir imediatamente na navegação.
    const categoriaAnimacao = secoesNav.find(secao => secao.titulo === titulo)
    if (categoriaAnimacao) {
      if (secaoAtiva === titulo) {
        animacaoPendenteRef.current = null
        dispararAnimacaoCategoria(categoriaAnimacao.chave)
      } else {
        animacaoPendenteRef.current = categoriaAnimacao
      }
    }
    definirSecaoAtiva(titulo)
    const comportamentoRolagem = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    const rolarPara = (elemento, alinhamento = 'start') => {
      const retangulo = elemento.getBoundingClientRect()
      const margem = alinhamento === 'center'
        ? (window.innerHeight - retangulo.height) / 2
        : 24
      window.scrollTo({
        top: Math.max(0, window.scrollY + retangulo.top - margem),
        behavior: comportamentoRolagem,
      })
    }
    const secao = document.getElementById(titulo)
    if (secao) {
      rolarPara(secao)
      return
    }
    const categoria = categorias.find(item => item.titulo === titulo)
    const primeiraObra = categoria && [...document.querySelectorAll('.galeria-grade-global .obra')]
      .find(card => card.classList.contains(`categoria-${categoria.chave}`))
    if (primeiraObra) {
      // A rolagem suave dispara atualizações do observer enquanto ainda está
      // chegando ao destino. Reafirma a seleção quando a rolagem terminar,
      // para que a navegação não volte temporariamente à categoria anterior.
      const confirmarDestino = () => {
        if (selecaoCategoriaTimerRef.current) {
          window.clearTimeout(selecaoCategoriaTimerRef.current)
          selecaoCategoriaTimerRef.current = null
        }
        if (scrollEndHandlerRef.current === confirmarDestino) {
          scrollEndHandlerRef.current = null
        }
        definirSecaoAtiva(titulo)
      }
      scrollEndHandlerRef.current = confirmarDestino
      window.addEventListener('scrollend', confirmarDestino, { once: true })
      rolarPara(primeiraObra, 'center')
      selecaoCategoriaTimerRef.current = window.setTimeout(() => {
        window.removeEventListener('scrollend', confirmarDestino)
        confirmarDestino()
      }, 2000)
    }
  }

  function voltarAoTopo() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, 0)
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (window.location.pathname === '/painel' || window.location.pathname === '/painel/') {
    return <CmsPage />
  }

  if (carregando) {
    return (
      <div className="carregando" role="status" aria-live="polite">
        <span className="carregando-anel" aria-hidden="true" />
        <span className="carregando-texto">Carregando</span>
      </div>
    )
  }

  const modoDiagnosticoGrade = new URLSearchParams(window.location.search).get('grade-debug') === '1'
  const layout = conteudo.layout || DEFAULT_LAYOUT_SETTINGS
  const isLayoutPreview = new URLSearchParams(window.location.search).has('layout_preview')
  const palettePrefix = tema === 'claro' ? 'light' : 'dark'
  const effectiveColors = {
    color_background: layout[`${palettePrefix}_color_background`],
    color_surface: layout[`${palettePrefix}_color_surface`],
    color_text: layout[`${palettePrefix}_color_text`],
    color_muted: layout[`${palettePrefix}_color_muted`],
    color_accent: layout[`${palettePrefix}_color_accent`],
  }
  const readableText = accessibleColor(effectiveColors.color_text, effectiveColors.color_background)
  const readableSurfaceText = accessibleColor(effectiveColors.color_text, effectiveColors.color_surface)
  const readableMuted = accessibleColor(effectiveColors.color_muted, effectiveColors.color_background)
  const readableSurfaceMuted = accessibleColor(effectiveColors.color_muted, effectiveColors.color_surface)
  const readableAccent = accessibleColor(effectiveColors.color_accent, effectiveColors.color_background)
  const readableAccentOnSurface = accessibleColor(effectiveColors.color_accent, effectiveColors.color_surface)
  const readableAccentOnOverlay = accessibleColor(effectiveColors.color_accent, '#051421')
  const readableNavMuted = accessibleColor(effectiveColors.color_muted, effectiveColors.color_surface)
  const readableTextOnAccent = accessibleColor(readableText, readableAccent)
  const layoutColors = {
    '--azul-escuro': effectiveColors.color_background,
    '--azul-medio': effectiveColors.color_surface,
    '--azul-claro': readableAccent,
    '--texto': readableText,
    '--linha': effectiveColors.color_muted + '44',
    '--layout-muted': readableMuted,
    '--layout-surface-text': readableSurfaceText,
    '--layout-surface-muted': readableSurfaceMuted,
    '--layout-text-on-accent': readableTextOnAccent,
    '--layout-accent-on-surface': readableAccentOnSurface,
    '--layout-accent-on-overlay': readableAccentOnOverlay,
    '--layout-nav-muted': readableNavMuted,
    '--layout-grid-title': '#ffffff',
    '--layout-grid-description': '#ffffff',
    '--rodape-fundo': effectiveColors.color_background,
    '--rodape-texto': readableText,
    '--rodape-muted': readableMuted,
  }
  const layoutAttributes = {
    style: { ...layoutColors, background: effectiveColors.color_background, color: readableText },
    'data-layout-width': layout.content_width,
    'data-layout-hero-align': layout.hero_alignment,
    'data-layout-hero-size': layout.hero_size,
    'data-layout-spacing': layout.section_spacing,
    'data-layout-gallery-columns': layout.gallery_columns,
    'data-layout-show-bio-image': String(layout.show_bio_image !== false),
    'data-layout-show-bio': String(layout.show_bio !== false),
    'data-layout-show-references': String(layout.show_references !== false),
  }

  if (modoDiagnosticoGrade) {
    return <GaleriaGradeDiagnostico categorias={categorias} />
  }

  if (previsualizacao && !previsualizacao.category) {
    const categoriaPreview = categorias[0]
    const obraPreview = categoriaPreview?.obras?.[0]
    return (
      <main className="site-shell preview-only-shell" {...layoutAttributes}>
        <FundoFantasma frames={conteudo.frames} />
        <header className="preview-only-header">
          <div>
            <span>PRÉVIA PRIVADA · LINK TEMPORÁRIO</span>
            <h1>{previsualizacao.titulo}</h1>
            <p>Visualização isolada da obra no design do portfólio. Nada aqui altera a publicação.</p>
          </div>
          <a href="/" aria-label="Sair da prévia e voltar ao portfólio">Sair da prévia ↗</a>
        </header>
        {categoriaPreview && obraPreview ? (
          <SecaoCategoria
            titulo={categoriaPreview.titulo}
            chave={categoriaPreview.chave}
            animacao={categoriaPreview.animacao}
            obras={[obraPreview]}
            indice={0}
          />
        ) : (
          <p className="preview-only-empty">Não foi possível carregar esta obra. Gere uma nova prévia pelo painel.</p>
        )}
      </main>
    )
  }

  if (previsualizacao?.category) {
    const categoria = categorias[0]
    return (
      <main className="site-shell preview-only-shell" {...layoutAttributes}>
        <FundoFantasma frames={conteudo.frames} />
        <header className="preview-only-header">
          <div><span>PRÉVIA DE ORGANIZAÇÃO · LINK TEMPORÁRIO</span><h1>{categoria?.titulo || previsualizacao.titulo}</h1><p>Somente esta categoria e sua nova ordem são exibidas. Nada foi publicado.</p></div>
          <a href="/" aria-label="Sair da prévia e voltar ao portfólio">Sair da prévia ↗</a>
        </header>
        {categoria ? <SecaoCategoria titulo={categoria.titulo} chave={categoria.chave} animacao={categoria.animacao} obras={categoria.obras} indice={0} /> : <p className="preview-only-empty">Não foi possível carregar esta categoria. Gere outra prévia pelo painel.</p>}
      </main>
    )
  }

  return (
    <div className="site-shell" {...layoutAttributes}>
      {isLayoutPreview && <div className="layout-preview-banner" role="status">PRÉVIA DE LAYOUT · alterações ainda não salvas</div>}
      {previsualizacao && !previsualizacao.category && (
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
        tema={tema}
        aoTrocarTema={() => setTema(atual => atual === 'escuro' ? 'claro' : 'escuro')}
      />
      {(layout.show_bio_image !== false || layout.show_bio !== false) && <Sobre perfil={sobre} mostrarImagem={layout.show_bio_image !== false} mostrarBio={layout.show_bio !== false} />}
      {modoGaleria === 'grade' ? (
        <GaleriaGrade categorias={categorias} />
      ) : (
        categorias.map((cat, indice) => (
          <SecaoCategoria
            key={cat.titulo}
            titulo={cat.titulo}
            chave={cat.chave}
            animacao={cat.animacao}
            obras={cat.obras}
            indice={indice}
            animando={animando === cat.chave}
          />
        ))
      )}
      {layout.show_references !== false && referencias.length > 0 && <Referencias referencias={referencias} />}
      <Contato endpoint={sobre.formulario} email={sobre.email} demoMode={isLayoutPreview} />
      <Footer nome={sobre.nome} instagram={sobre.instagram} email={sobre.email} redes={conteudo.redes} />
      <div className="controles-flutuantes" role="group" aria-label="Controles de visualização">
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
        <button
          type="button"
          className="alternar-modo-flutuante"
          aria-label={modoGaleria === 'lista' ? 'Alternar para visualização em grade' : 'Alternar para visualização em lista'}
          title={modoGaleria === 'lista' ? 'Ver em grade' : 'Ver em lista'}
          onClick={() => trocarModoGaleria(modoGaleria === 'lista' ? 'grade' : 'lista')}
        >
          <span aria-hidden="true">{modoGaleria === 'lista' ? '▦' : '☷'}</span>
          <span>{modoGaleria === 'lista' ? 'Grade' : 'Lista'}</span>
        </button>
      </div>
    </div>
  )
}