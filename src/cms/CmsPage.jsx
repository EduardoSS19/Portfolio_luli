import { useCallback, useEffect, useMemo, useState } from 'react'
import './CmsPage.css'
import { CmsWorkEditor } from './CmsWorkEditor.jsx'

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

  const saveWork = async payload => {
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
      setCreatingWork(false)
      setLibraryRefresh(value => value + 1)
    } else {
      setWorks(current => current.map(item => item.id === result.id
        ? { ...item, title: result.title, category: result.category }
        : item))
    }
    return result
  }

  const uploadCover = async (workId, file) => {
    const formData = new FormData()
    formData.append('image', file)
    const response = await fetch('/api/cms/works/' + workId + '/cover/', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'X-CSRFToken': readCookie('csrftoken'),
      },
      body: formData,
    })
    if (response.status === 401) throw new Error('Sua sessão expirou. Entre novamente para continuar.')
    if (response.status === 403) throw new Error('Sua conta não tem permissão para alterar imagens desta obra.')
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const messages = {
        image_too_large: 'A imagem deve ter no máximo 15 MB.',
        unsupported_image_format: 'Use uma imagem JPG, PNG ou WebP.',
        invalid_image_file: 'O arquivo enviado não é uma imagem válida.',
        invalid_image_dimensions: 'A imagem excede as dimensões permitidas.',
        image_storage_failed: 'Não foi possível armazenar a imagem. A capa anterior foi preservada.',
      }
      throw new Error(messages[result.error] || 'Não foi possível enviar a imagem. Tente novamente.')
    }
    setSelectedWork(current => current ? { ...current, image: result.image } : current)
    setWorks(current => current.map(item => item.id === result.id ? { ...item, image: result.image, media: { ...item.media, images: 1 } } : item))
    setLibraryRefresh(value => value + 1)
    return result
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
    document.title = 'Painel editorial · Luli Becker'
    document.documentElement.dataset.theme = 'escuro'
    return () => { document.title = 'Portfólio' }
  }, [])

  if (forbidden) return <LoginRequired forbidden />
  if (error?.code === 'authentication_required') return <LoginRequired />

  const isOverview = section === 'overview'

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
          <button className={!isOverview ? 'active' : ''} onClick={() => setSection('library')}><span>▦</span> Obras <span className="cms-nav-count">{formatNumber(overview?.works?.total)}</span></button>
        </nav>
        <div className="cms-sidebar-bottom">
          <span className="cms-online-dot" />
          <span>Conectado ao portfólio</span>
          <a href="/" title="Abrir site público">↗</a>
        </div>
      </aside>

      <main className="cms-main">
        <header className="cms-topbar">
          <div className="cms-breadcrumb">LULI BECKER <span>/</span> {isOverview ? 'VISÃO GERAL' : 'BIBLIOTECA'}</div>
          <div className="cms-top-actions">
            <span className="cms-live-label"><i /> Site publicado</span>
            <a href="/" target="_blank" rel="noreferrer">Ver portfólio ↗</a>
          </div>
        </header>

        <div className="cms-content">
          {isOverview ? (
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
                  <div><span>Referências</span><strong>{formatNumber(overview?.references)}</strong></div>
                  <div><span>Vídeos vinculados</span><strong>{formatNumber(overview?.videos)}</strong></div>
                  <div><span>Estado do site</span><strong className="cms-published-state">Publicado</strong></div>
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
                  onUploadCover={uploadCover}
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
              {loading ? <div className="cms-loading">Atualizando biblioteca…</div> : works.length ? (
                <>
                  <section className="cms-work-grid" aria-label="Obras cadastradas">
                    {works.map(work => (
                      <article className="cms-work-card" key={work.id}>
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
