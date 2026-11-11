import { useCallback, useEffect, useMemo, useState } from 'react'
import './CmsPage.css'

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
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [forbidden, setForbidden] = useState(false)
  const [section, setSection] = useState('overview')

  const categories = useMemo(() => {
    const unique = new Map()
    works.forEach(work => {
      if (work.category?.key) unique.set(work.category.key, work.category.title)
    })
    return [...unique.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [works])

  const load = useCallback(async (signal) => {
    setLoading(true)
    setError(null)
    try {
      const [summary, library] = await Promise.all([
        requestJson('/api/cms/overview/', signal),
        requestJson('/api/cms/works/?limit=' + PAGE_SIZE + '&offset=' + offset + '&status=' + encodeURIComponent(status) + '&category=' + encodeURIComponent(category === 'all' ? '' : category) + '&q=' + encodeURIComponent(query.trim()), signal),
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
  }, [category, offset, query, status])

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
                  <p className="cms-eyebrow">QUARTA-FEIRA · SEU ESPAÇO CRIATIVO</p>
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
              <section className="cms-library-heading">
                <div><p className="cms-eyebrow">ACERVO COMPLETO</p><h1>Biblioteca<span>.</span></h1><p>Encontre e acompanhe as obras do seu portfólio.</p></div>
                <span className="cms-total-pill">{formatNumber(pagination.total)} obras</span>
              </section>
              <section className="cms-library-tools" aria-label="Filtros da biblioteca">
                <label className="cms-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => { setQuery(event.target.value); setOffset(0) }} placeholder="Buscar por nome, descrição…" /><kbd>⌘ K</kbd></label>
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
          {error && !isOverview && null}
        </div>
      </main>
    </div>
  )
}
