import { useCallback, useEffect, useMemo, useState } from 'react'
import './CmsPage.css'
import { CmsWorkEditor } from './CmsWorkEditor.jsx'
import { CmsAnalytics } from './CmsAnalytics.jsx'
import { CmsCategoryManager } from './CmsCategoryManager.jsx'
import { CmsProfileManager } from './CmsProfileManager.jsx'
import { CmsContentManager } from './CmsContentManager.jsx'

const PAGE_SIZE = 24

async function requestJson(url, signal) {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  if (response.status === 401) {
    const error = new Error('Sua sessão não está ativa.')
    error.code = 'authentication_required'
    throw error
  }
  if (response.status === 403) {
    const error = new Error('Este usuário não tem permissão para acessar o painel.')
    error.code = 'staff_required'
    throw error
  }
  if (!response.ok) throw new Error('Não foi possível carregar os dados. Tente novamente.')
  return response.json()
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(value || 0)
}

function StatCard({ label, value, detail, icon }) {
  return (
    <article className="cms-stat-card">
      <div className="cms-stat-top">
        <span>{label}</span>
        <span className="cms-stat-icon" aria-hidden="true">{icon}</span>
      </div>
      <strong>{formatNumber(value)}</strong>
      <small>{detail}</small>
    </article>
  )
}

function LoginRequired({ forbidden = false }) {
  return (
    <main className="cms-access-screen">
      <div className="cms-access-mark">LB<span>.</span></div>
      <p className="cms-eyebrow">ÁREA DE EDIÇÃO</p>
      <h1>{forbidden ? 'Acesso não autorizado' : 'Entre para continuar'}</h1>
      <p>{forbidden ? 'Sua conta não tem permissão de equipe para acessar este painel.' : 'Faça login com sua conta de equipe para acessar o espaço de trabalho da Luli.'}</p>
      {!forbidden && <a className="cms-primary-button" href="/admin/login/?next=/painel">Entrar no painel <span aria-hidden="true">↗</span></a>}
      {forbidden && <a className="cms-secondary-link" href="/">Voltar ao portfólio</a>}
    </main>
  )
}

export function CmsPage() {
  const [overview, setOverview] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [works, setWorks] = useState([])
  const [pagination, setPagination] = useState({ total: 0, hasMore: false })
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [forbidden, setForbidden] = useState(false)
  const [section, setSection] = useState('overview')
  const [selectedWork, setSelectedWork] = useState(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState(null)
  const [creatingWork, setCreatingWork] = useState(false)
  const [libraryRefresh, setLibraryRefresh] = useState(0)
  const [selectedWorkIds, setSelectedWorkIds] = useState([])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 250)
    return () => window.clearTimeout(timeout)
  }, [query])

  const categories = useMemo(() => (overview?.categoryOptions || []).map(item => [item.key, item.title]), [overview])

  const categoryOptions = overview?.categoryOptions || []

  const openWork = async workId => {
    setCreatingWork(false)
    setSelectedWork(null)
    setEditError(null)
    setEditLoading(true)
    setSection('library')
    try {
      const detail = await requestJson('/api/cms/works/' + workId + '/')
      setSelectedWork(detail)
    } catch (err) {
      setEditError(err)
    } finally {
      setEditLoading(false)
    }
  }

  const startNewWork = () => {
    setEditError(null)
    setCreatingWork(true)
    setSelectedWork({
      id: null,
      category: categoryOptions[0]?.id ?? '',
      title: '',
      description: '',
      detail: '',
      technique: '',
      material: '',
      support: '',
      year: '',
      height: '',
      width: '',
      depth: '',
      dimension_unit: 'cm',
      price: '',
      currency: 'BRL',
      availability: '',
      series: '',
      edition: '',
      print_run: '',
      signed: null,
      creation_location: '',
      condition: '',
      exhibitions: '',
      position: 0,
      published: false,
    })
    setSection('library')
  }

  const saveWork = async (payload, { addAnother = false } = {}) => {
    const creating = creatingWork
    const endpoint = creating ? '/api/cms/works/create/' : '/api/cms/works/' + selectedWork.id + '/'
    const response = await fetch(endpoint, {
      method: creating ? 'POST' : 'PATCH',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRFToken': readCookie('csrftoken'),
      },
      body: JSON.stringify(payload),
    })
    if (response.status === 401) throw new Error('Sua sessão expirou. Entre novamente para continuar.')
    if (response.status === 403) throw new Error(creating ? 'Sua conta não tem permissão para cadastrar obras.' : 'Sua conta não tem permissão para editar obras. Verifique o acesso de equipe.')
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const messages = Object.values(result.fields || {}).flat().map(item => item.message).filter(Boolean)
      throw new Error(messages.join(' · ') || 'Não foi possível salvar. Revise os campos e tente novamente.')
    }
    setSelectedWork({ ...selectedWork, ...result, category: result.category.id })
    if (creating) {
      setLibraryRefresh(value => value + 1)
      if (addAnother) {
        setCreatingWork(true)
        setSelectedWork({ id: null, category: String(result.category.id), title: '', description: '', detail: '', technique: '', material: '', support: '', year: '', height: '', width: '', depth: '', dimension_unit: 'cm', price: '', currency: 'BRL', availability: '', series: '', edition: '', print_run: '', signed: null, creation_location: '', condition: '', exhibitions: '', position: Number(result.position || 0) + 1, published: false })
      } else {
        setCreatingWork(false)
      }
    } else {
      setWorks(current => current.map(item => item.id === result.id
        ? { ...item, title: result.title, category: result.category }
        : item))
    }
    return result
  }

  const uploadWorkCover = async file => {
    if (!selectedWork?.id) throw new Error('Salve a obra antes de enviar uma imagem.')
    const formData = new FormData()
    formData.append('image', file)
    const response = await fetch('/api/cms/works/' + selectedWork.id + '/cover/', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
      body: formData,
    })
    if (response.status === 401) throw new Error('Sua sessão expirou. Entre novamente para continuar.')
    if (response.status === 403) throw new Error('Sua conta não tem permissão para alterar a capa desta obra.')
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const messages = {
        invalid_image_file: 'O arquivo não parece ser uma imagem válida.',
        unsupported_image_format: 'Use uma imagem JPG, PNG ou WebP.',
        image_too_large: 'A imagem deve ter no máximo 15 MB.',
        invalid_image_dimensions: 'A imagem tem dimensões muito grandes.',
        image_storage_failed: 'Não foi possível armazenar a imagem. A capa anterior foi preservada.',
      }
      throw new Error(messages[result.error] || 'Não foi possível enviar a capa. Tente novamente.')
    }
    setSelectedWork(current => ({ ...current, image: result.image }))
    setWorks(current => current.map(item => item.id === result.id ? { ...item, image: result.image, media: { ...item.media, images: 1 } } : item))
    setLibraryRefresh(value => value + 1)
    return result
  }


  const loadWorkGallery = useCallback(async workId => {
    const result = await requestJson('/api/cms/works/' + workId + '/gallery/')
    return result.results || []
  }, [])

  const uploadGalleryImage = useCallback(async (workId, file) => {
    const formData = new FormData()
    formData.append('image', file)
    const response = await fetch('/api/cms/works/' + workId + '/gallery/', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
      body: formData,
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error === 'image_too_large' ? 'Cada imagem deve ter no máximo 15 MB.' : result.error === 'unsupported_image_format' ? 'Use imagens JPG, PNG ou WebP.' : result.error === 'invalid_image_file' ? 'Um dos arquivos não é uma imagem válida.' : result.error === 'image_storage_failed' ? 'Não foi possível armazenar a imagem.' : 'Não foi possível adicionar a imagem à galeria.')
    setLibraryRefresh(value => value + 1)
    return result
  }, [])

  const replaceGalleryImage = useCallback(async (workId, imageId, file) => {
    const formData = new FormData()
    formData.append('image', file)
    const response = await fetch('/api/cms/works/' + workId + '/gallery/' + imageId + '/', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
      body: formData,
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error === 'image_too_large' ? 'A imagem deve ter no máximo 15 MB.' : 'Não foi possível substituir esta imagem.')
    setLibraryRefresh(value => value + 1)
    return result
  }, [])

  const deleteGalleryImage = useCallback(async (workId, imageId) => {
    const response = await fetch('/api/cms/works/' + workId + '/gallery/' + imageId + '/delete/', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error('Não foi possível remover esta imagem da galeria.')
    setLibraryRefresh(value => value + 1)
    return result
  }, [])

  const reorderGalleryImages = useCallback(async (workId, imageIds) => {
    const response = await fetch('/api/cms/works/' + workId + '/gallery/', {
      method: 'PATCH',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
      body: JSON.stringify({ imageIds }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error('Não foi possível salvar a ordem das imagens.')
    return result.results || []
  }, [])

  const loadWorkVideos = useCallback(async workId => {
    const result = await requestJson('/api/cms/works/' + workId + '/videos/')
    return result.results || []
  }, [])

  const addWorkVideo = useCallback(async (workId, youtubeUrl) => {
    const response = await fetch('/api/cms/works/' + workId + '/videos/', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
      body: JSON.stringify({ youtubeUrl }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const messages = {
        video_already_attached: 'Este vídeo já está vinculado a esta obra.',
        invalid_youtube_url: 'Informe um link válido do YouTube.',
        youtube_metadata_error: result.message || 'Não foi possível validar o vídeo. Verifique se ele está público e permite incorporação.',
      }
      throw new Error(messages[result.error] || 'Não foi possível adicionar o vídeo.')
    }
    setLibraryRefresh(value => value + 1)
    return result
  }, [])

  const updateWorkVideo = useCallback(async (workId, videoId, youtubeUrl) => {
    const response = await fetch('/api/cms/works/' + workId + '/videos/' + videoId + '/', {
      method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
      body: JSON.stringify({ youtubeUrl }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.message || (result.error === 'video_already_attached' ? 'Este vídeo já está vinculado à obra.' : 'Não foi possível atualizar o vídeo.'))
    setLibraryRefresh(value => value + 1)
    return result
  }, [])

  const deleteWorkVideo = useCallback(async (workId, videoId) => {
    const response = await fetch('/api/cms/works/' + workId + '/videos/' + videoId + '/delete/', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error('Não foi possível remover este vídeo.')
    setLibraryRefresh(value => value + 1)
    return result
  }, [])

  const reorderWorkVideos = useCallback(async (workId, videoIds) => {
    const response = await fetch('/api/cms/works/' + workId + '/videos/', {
      method: 'PATCH',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
      body: JSON.stringify({ videoIds }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error('Não foi possível salvar a ordem dos vídeos.')
    return result.results || []
  }, [])

  const createWorkPreview = useCallback(async workId => {
    const response = await fetch('/api/cms/works/' + workId + '/preview/', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const messages = {
        authentication_required: 'Sua sessão expirou. Entre novamente para continuar.',
        staff_required: 'Sua conta não tem acesso ao painel.',
        work_view_permission_required: 'Sua conta não tem permissão para visualizar esta obra.',
        work_not_found: 'Esta obra não foi encontrada.',
      }
      throw new Error(messages[result.error] || 'Não foi possível gerar a prévia.')
    }
    return result.url
  }, [])

  const setWorkPublication = useCallback(async (workId, published) => {
    const response = await fetch('/api/cms/works/' + workId + '/publish/', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
      body: JSON.stringify({ published }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const messages = {
        authentication_required: 'Sua sessão expirou. Entre novamente para continuar.',
        staff_required: 'Sua conta não tem acesso ao painel.',
        work_edit_permission_required: 'Sua conta não tem permissão para publicar obras.',
        work_not_found: 'Esta obra não foi encontrada.',
      }
      throw new Error(messages[result.error] || 'Não foi possível atualizar a publicação.')
    }
    setSelectedWork(current => current?.id === workId ? { ...current, published: result.published } : current)
    setLibraryRefresh(value => value + 1)
    return result
  }, [])
  const deleteWork = async workId => {
    const response = await fetch('/api/cms/works/' + workId + '/delete/', {
      method: 'DELETE',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error === 'work_delete_permission_required' ? 'Sua conta não tem permissão para excluir obras.' : 'Não foi possível excluir esta obra.')
    setSelectedWork(null)
    setCreatingWork(false)
    setLibraryRefresh(value => value + 1)
  }

  const bulkSetPublication = async published => {
    if (!selectedWorkIds.length) return
    const action = published ? 'publicar' : 'despublicar'
    if (!window.confirm(action[0].toUpperCase() + action.slice(1) + ' ' + selectedWorkIds.length + ' obra(s) selecionada(s)?')) return
    const response = await fetch('/api/cms/works/bulk-publish/', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
      body: JSON.stringify({ ids: selectedWorkIds, published }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error === 'work_edit_permission_required' ? 'Sua conta não tem permissão para publicar obras.' : 'Não foi possível atualizar as obras selecionadas.')
    setSelectedWorkIds([])
    setLibraryRefresh(value => value + 1)
  }

  const readCookie = name => {
    const prefix = name + '='
    const item = document.cookie.split('; ').find(cookie => cookie.startsWith(prefix))
    return item ? decodeURIComponent(item.slice(prefix.length)) : ''
  }


  const load = useCallback(async (signal) => {
    setLoading(true)
    setError(null)
    try {
      const [summary, library] = await Promise.all([
        requestJson('/api/cms/overview/', signal),
        requestJson('/api/cms/works/?limit=' + PAGE_SIZE + '&offset=' + offset + '&status=' + encodeURIComponent(status) + '&category=' + encodeURIComponent(category === 'all' ? '' : category) + '&q=' + encodeURIComponent(debouncedQuery.trim()), signal),
      ])
      setOverview(summary)
      setWorks(library.results || [])
      setSelectedWorkIds(current => current.filter(id => (library.results || []).some(item => item.id === id)))
      setPagination(library.pagination || { total: 0, hasMore: false })
      setForbidden(false)
    } catch (err) {
      if (err.name === 'AbortError') return
      if (err.code === 'authentication_required') setError(err)
      else if (err.code === 'staff_required') setForbidden(true)
      else setError(err)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [category, debouncedQuery, offset, status, libraryRefresh])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    if (section !== 'analytics') {
      setAnalytics(null)
      return
    }

    const controller = new AbortController()
    setAnalytics(null)
    requestJson('/api/cms/analytics/', controller.signal)
      .then(data => {
        if (!controller.signal.aborted) setAnalytics(data)
      })
      .catch(err => {
        if (err.name !== 'AbortError' && !controller.signal.aborted) {
          setAnalytics({ status: 'error' })
        }
      })

    return () => controller.abort()
  }, [section])

  useEffect(() => {
    document.title = 'Painel editorial · Luli Becker'
    document.documentElement.dataset.theme = 'escuro'
    return () => { document.title = 'Portfólio' }
  }, [])

  if (forbidden) return <LoginRequired forbidden />
  if (error?.code === 'authentication_required') return <LoginRequired />

  const isOverview = section === 'overview'
  const isCategories = section === 'categories'
  const isProfile = section === 'profile'
  const isContent = section === 'content'
  const isLibrary = section === 'library'
  const isAnalytics = section === 'analytics'

  return (
    <div className="cms-shell">
      <aside className="cms-sidebar">
        <a className="cms-brand" href="/" aria-label="Voltar ao portfólio">
          <span className="cms-brand-mark">LB<span>.</span></span>
          <span className="cms-brand-caption">ESPAÇO DE EDIÇÃO</span>
        </a>
        <div className="cms-sidebar-label">ESPAÇO DE TRABALHO</div>
        <nav className="cms-nav" aria-label="Menu do painel">
          <button className={isOverview ? 'active' : ''} onClick={() => setSection('overview')}><span>◫</span> Visão geral</button>
          <button className={isLibrary ? 'active' : ''} onClick={() => { setSelectedWork(null); setCreatingWork(false); setSection('library') }}><span>▦</span> Obras <span className="cms-nav-count">{formatNumber(overview?.works?.total)}</span></button>
          <button className={isCategories ? 'active' : ''} onClick={() => setSection('categories')}><span>▤</span> Categorias</button>
          <button className={isProfile ? 'active' : ''} onClick={() => setSection('profile')}><span>◉</span> Perfil</button>
          <button className={isContent ? 'active' : ''} onClick={() => setSection('content')}><span>↗</span> Conteúdo</button>
          <button className={isAnalytics ? 'active' : ''} onClick={() => setSection('analytics')}><span>◷</span> Estatísticas</button>
        </nav>
        <div className="cms-sidebar-bottom">
          <span className="cms-online-dot" />
          <span>Conectado ao portfólio</span>
          <a href="/" title="Abrir site público">↗</a>
        </div>
      </aside>

      <main className="cms-main">
        <header className="cms-topbar">
          <div className="cms-breadcrumb">LULI BECKER <span>/</span> {isOverview ? 'VISÃO GERAL' : isCategories ? 'CATEGORIAS' : isProfile ? 'PERFIL' : isContent ? 'CONTEÚDO' : isAnalytics ? 'ESTATÍSTICAS' : 'BIBLIOTECA'}</div>
          <div className="cms-top-actions">
            <span className="cms-live-label"><i /> Site publicado</span>
            <button className="cms-home-shortcut" type="button" onClick={() => { setSelectedWork(null); setCreatingWork(false); setEditError(null); setSection('overview') }}>← Início do painel</button>
            <a href="/" target="_blank" rel="noreferrer">Ver portfólio ↗</a>
          </div>
        </header>

        <div className="cms-content">
          {isAnalytics ? (
            <><section className="cms-library-heading"><div><p className="cms-eyebrow">DESEMPENHO DO PORTFÓLIO</p><h1>Estatísticas<span>.</span></h1><p>Acompanhe como as pessoas encontram e navegam pelo site.</p></div></section><CmsAnalytics data={analytics} /></>
          ) : isProfile ? (
            <CmsProfileManager />
          ) : isCategories ? (
            <CmsCategoryManager onChanged={() => setLibraryRefresh(value => value + 1)} />
          ) : isOverview ? (
            <>
              <section className="cms-welcome">
                <div>
                  <p className="cms-eyebrow">SEU ESPAÇO CRIATIVO</p>
                  <h1>Olá, Luli<span>.</span></h1>
                  <p>Seu trabalho, organizado em um só lugar.</p>
                </div>
                <div className="cms-welcome-art" aria-hidden="true"><span>✳</span><i>LB</i></div>
              </section>
              <section className="cms-section-heading">
                <div><p className="cms-eyebrow">ACERVO</p><h2>Seu portfólio em números</h2></div>
                <button className="cms-text-button" onClick={() => setSection('library')}>Explorar obras <span>↗</span></button>
              </section>
              {loading && !overview ? <div className="cms-loading">Carregando seu espaço…</div> : (
                <section className="cms-stats-grid">
                  <StatCard label="Obras no acervo" value={overview?.works?.total} detail="Todas as obras cadastradas" icon="▧" />
                  <StatCard label="Publicadas" value={overview?.works?.published} detail="Visíveis no portfólio" icon="◉" />
                  <StatCard label="Rascunhos" value={overview?.works?.drafts} detail="Ainda não publicadas" icon="✎" />
                  <StatCard label="Categorias" value={overview?.categories} detail="Organização do acervo" icon="▦" />
                </section>
              )}
              <section className="cms-section-heading cms-analytics-shortcut"><div><p className="cms-eyebrow">GOOGLE ANALYTICS 4</p><h2>Entenda o alcance do seu trabalho</h2></div><button className="cms-text-button" onClick={() => setSection('analytics')}>Abrir estatísticas ↗</button></section>
              <section className="cms-dashboard-shortcuts" aria-label="Atalhos de gestão"><button type="button" onClick={() => setSection('categories')}><strong>Categorias</strong><span>Organize as seções e a ordem do acervo →</span></button><button type="button" onClick={() => setSection('profile')}><strong>Perfil</strong><span>Edite apresentação e contato →</span></button><button type="button" onClick={() => setSection('content')}><strong>Conteúdo complementar</strong><span>Redes sociais, referências e fundos →</span></button></section>
              <section className="cms-lower-grid">
                <article className="cms-feature-card">
                  <div className="cms-feature-symbol">✳</div>
                  <p className="cms-eyebrow">BIBLIOTECA DE OBRAS</p>
                  <h3>Um lugar para cuidar de cada detalhe.</h3>
                  <p>Consulte suas obras, encontre trabalhos rapidamente e acompanhe o que já está publicado.</p>
                  <button className="cms-primary-button" onClick={() => setSection('library')}>Abrir biblioteca <span>↗</span></button>
                </article>
                <article className="cms-quick-card">
                  <p className="cms-eyebrow">CONTEÚDO DO SITE</p>
                  <button type="button" onClick={() => setSection('content')}><span>Referências</span><strong>{formatNumber(overview?.references)} ↗</strong></button>
                  <button type="button" onClick={() => setSection('library')}><span>Vídeos vinculados</span><strong>{formatNumber(overview?.videos)} ↗</strong></button>
                  <button type="button" onClick={() => setSection('profile')}><span>Perfil do portfólio</span><strong>Editar ↗</strong></button>
                </article>
              </section>
            </>
          ) : (
            <>
              {selectedWork ? (
                <CmsWorkEditor
                  work={selectedWork}
                  categories={categoryOptions}
                  isNew={creatingWork}
                  onCancel={() => { setSelectedWork(null); setCreatingWork(false); setEditError(null) }}
                  onSave={saveWork}
                  onUploadCover={uploadWorkCover}
                  onLoadGallery={loadWorkGallery}
                  onUploadGalleryImage={uploadGalleryImage}
                  onReplaceGalleryImage={replaceGalleryImage}
                  onDeleteGalleryImage={deleteGalleryImage}
                  onReorderGalleryImages={reorderGalleryImages}
                  onLoadVideos={loadWorkVideos}
                  onAddVideo={addWorkVideo}
                  onUpdateVideo={updateWorkVideo}
                  onDeleteVideo={deleteWorkVideo}
                  onReorderVideos={reorderWorkVideos}
                  onPreview={createWorkPreview}
                  onPublish={setWorkPublication}
                  onDelete={deleteWork}
                  canDelete={overview?.permissions?.canDeleteWork}
                />
              ) : editLoading ? (
                <div className="cms-loading">Abrindo a ficha da obra…</div>
              ) : editError ? (
                <div className="cms-error" role="alert">{editError.message}<button onClick={() => setEditError(null)}>Fechar</button></div>
              ) : (
              <>
              <section className="cms-library-heading">
                <div><p className="cms-eyebrow">ACERVO COMPLETO</p><h1>Biblioteca<span>.</span></h1><p>Encontre e acompanhe as obras do seu portfólio.</p></div>
                <div className="cms-library-heading-actions">
                  <span className="cms-total-pill">{formatNumber(pagination.total)} obras</span>
                  {overview?.permissions?.canCreateWork && <button className="cms-primary-button" type="button" onClick={startNewWork} disabled={!categoryOptions.length}>+ Nova obra</button>}
                </div>
              </section>
              <section className="cms-library-tools" aria-label="Filtros da biblioteca">
                <label className="cms-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => { setQuery(event.target.value); setOffset(0) }} placeholder="Buscar por nome, descrição…" /></label>
                <select aria-label="Filtrar por publicação" value={status} onChange={event => { setStatus(event.target.value); setOffset(0) }}>
                  <option value="all">Todas as obras</option><option value="published">Publicadas</option><option value="draft">Rascunhos</option>
                </select>
                <select aria-label="Filtrar por categoria" value={category} onChange={event => { setCategory(event.target.value); setOffset(0) }}>
                  <option value="all">Todas as categorias</option>
                  {categories.map(([key, title]) => <option key={key} value={key}>{title}</option>)}
                </select>
              </section>
              {error && <div className="cms-error" role="alert">{error.message}<button onClick={() => load()}>Tentar novamente</button></div>}
              {selectedWorkIds.length > 0 && overview?.permissions?.canEditWork && <div className="cms-bulk-actions"><strong>{selectedWorkIds.length} obra(s) selecionada(s)</strong><button type="button" onClick={() => bulkSetPublication(true)}>Publicar selecionadas</button><button type="button" onClick={() => bulkSetPublication(false)}>Despublicar selecionadas</button><button type="button" onClick={() => setSelectedWorkIds([])}>Limpar seleção</button></div>}
              {loading ? <div className="cms-loading">Atualizando biblioteca…</div> : works.length ? (
                <>
                  <section className="cms-work-grid" aria-label="Obras cadastradas">
                    {works.map(work => (
                      <article className="cms-work-card" key={work.id}>
                        <label className="cms-work-select"><input type="checkbox" checked={selectedWorkIds.includes(work.id)} onChange={event => setSelectedWorkIds(current => event.target.checked ? [...current, work.id] : current.filter(id => id !== work.id))} aria-label={'Selecionar ' + work.title} /> Selecionar</label>
                        <div className="cms-work-image">
                          {work.image ? <img src={work.image} alt="" loading="lazy" /> : <div className="cms-no-image"><span>✳</span><small>SEM IMAGEM</small></div>}
                          <span className={`cms-work-status ${work.published ? 'published' : 'draft'}`}>{work.published ? 'Publicada' : 'Rascunho'}</span>
                        </div>
                        <div className="cms-work-info"><div><h3>{work.title}</h3><p>{work.category?.title || 'Sem categoria'}</p></div><span className="cms-work-arrow">↗</span></div>
                        <div className="cms-work-meta"><span>{work.media?.images + work.media?.gallery || 0} imagens</span><span>{work.media?.videos || 0} vídeos</span></div>
                        {overview?.permissions?.canEditWork && <button className="cms-work-edit" type="button" onClick={() => openWork(work.id)}>Editar obra <span>→</span></button>}
                      </article>
                    ))}
                  </section>
                  <div className="cms-pagination">
                    <span>Exibindo {formatNumber(offset + 1)}–{formatNumber(offset + works.length)} de {formatNumber(pagination.total)}</span>
                    <div><button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>← Anterior</button><button disabled={!pagination.hasMore} onClick={() => setOffset(offset + PAGE_SIZE)}>Próxima →</button></div>
                  </div>
                </>
              ) : <div className="cms-empty"><span>⌕</span><h3>Nenhuma obra encontrada</h3><p>Tente mudar os filtros ou buscar por outro termo.</p><button onClick={() => { setQuery(''); setStatus('all'); setCategory('all'); setOffset(0) }}>Limpar filtros</button></div>}
              </>
              )}
            </>
          )}
          {error && !isOverview && null}
        </div>
      </main>
    </div>
  )
}
