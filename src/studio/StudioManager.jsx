import { useEffect, useState } from 'react'
import './StudioManager.css'

const emptyTemplate = {
  id: null, slug: '', title: '', kind: '', description: '',
  presentationMode: 'editorial', previewShape: 'editorial',
  tagsText: '', position: 0, isPublished: false,
}

function csrfToken() {
  return document.cookie.split('; ').find(item => item.startsWith('csrftoken='))?.split('=')[1] || ''
}

function toForm(item) {
  return {
    id: item.id, slug: item.slug, title: item.title, kind: item.kind || '',
    description: item.description || '', presentationMode: item.presentationMode || 'editorial',
    previewShape: item.previewShape || 'editorial',
    tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    position: item.position || 0, isPublished: Boolean(item.isPublished),
  }
}

function toPayload(form) {
  return {
    slug: form.slug.trim(), title: form.title.trim(), kind: form.kind.trim(),
    description: form.description.trim(), presentation_mode: form.presentationMode,
    preview_shape: form.previewShape,
    tags: form.tagsText.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 20),
    layout_config: {}, position: Number(form.position) || 0, is_published: form.isPublished,
  }
}

export function StudioManager() {
  const [items, setItems] = useState([])
  const [permissions, setPermissions] = useState({})
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/studio/manage/templates/', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(response.status === 401 ? 'Entre com sua conta de equipe para continuar.' : response.status === 403 ? 'Sua conta não tem permissão para administrar os modelos do estúdio.' : 'Não foi possível carregar o catálogo.')
      setItems(data.results || [])
      setPermissions(data.permissions || {})
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function save(event) {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(form.id ? `/api/studio/manage/templates/${form.id}/` : '/api/studio/manage/templates/', {
        method: form.id ? 'PATCH' : 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
        body: JSON.stringify(toPayload(form)),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const detail = Object.values(data.fields || {}).flat().map(item => item.message).filter(Boolean).join(' · ')
        throw new Error(detail || 'Não foi possível salvar o modelo.')
      }
      setForm(null)
      await load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function remove(item) {
    if (!window.confirm(`Excluir o modelo “${item.title}”? Essa ação não pode ser desfeita.`)) return
    setError('')
    try {
      const response = await fetch(`/api/studio/manage/templates/${item.id}/`, {
        method: 'DELETE', credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-CSRFToken': csrfToken() },
      })
      if (!response.ok) throw new Error(response.status === 403 ? 'Sua conta não pode excluir modelos.' : 'Não foi possível excluir o modelo.')
      await load()
    } catch (err) { setError(err.message) }
  }

  return <main className="studio-manager">
    <header className="studio-manager-header">
      <div><p className="studio-manager-eyebrow">ESTÚDIO / ADMINISTRAÇÃO</p><h1>Modelos<span>.</span></h1><p>Organize as experiências que aparecem na casa dos modelos.</p></div>
      <a href="/studio">Ver estúdio ↗</a>
    </header>
    {error && <p className="studio-manager-error" role="alert">{error}</p>}
    {loading ? <p className="studio-manager-muted">Carregando catálogo…</p> : <>
      <div className="studio-manager-toolbar"><span>{items.length} modelos cadastrados</span>{permissions.canAdd && <button type="button" onClick={() => setForm({ ...emptyTemplate })}>Adicionar modelo +</button>}</div>
      <div className="studio-manager-list">
        {items.map(item => <article key={item.id} className="studio-manager-item">
          <div><span className={item.isPublished ? 'studio-manager-status published' : 'studio-manager-status'}>{item.isPublished ? 'PUBLICADO' : 'RASCUNHO'}</span><h2>{item.title}</h2><p>{item.kind || item.presentationMode} · posição {item.position}</p></div>
          <div className="studio-manager-actions">{permissions.canChange && <button type="button" onClick={() => setForm(toForm(item))}>Editar</button>}{permissions.canDelete && <button type="button" className="danger" onClick={() => remove(item)}>Excluir</button>}</div>
        </article>)}
        {!items.length && <p className="studio-manager-muted">Nenhum modelo cadastrado.</p>}
      </div>
    </>}
    {form && <div className="studio-manager-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setForm(null) }}>
      <form className="studio-manager-form" onSubmit={save}>
        <div className="studio-manager-form-heading"><div><p className="studio-manager-eyebrow">CATÁLOGO</p><h2>{form.id ? 'Editar modelo' : 'Novo modelo'}</h2></div><button type="button" onClick={() => setForm(null)} aria-label="Fechar">×</button></div>
        <label>Nome<input required maxLength="100" value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))}/></label>
        <label>Identificador (slug)<input required pattern="[a-z0-9-]+" maxLength="60" value={form.slug} onChange={e => setForm(v => ({ ...v, slug: e.target.value }))}/></label>
        <label>Categoria<input maxLength="60" value={form.kind} onChange={e => setForm(v => ({ ...v, kind: e.target.value }))}/></label>
        <label>Descrição<textarea required rows="3" value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))}/></label>
        <div className="studio-manager-form-grid">
          <label>Modo de apresentação<input required maxLength="40" value={form.presentationMode} onChange={e => setForm(v => ({ ...v, presentationMode: e.target.value }))}/></label>
          <label>Forma da prévia<input required maxLength="40" pattern="[a-z0-9-]+" value={form.previewShape} onChange={e => setForm(v => ({ ...v, previewShape: e.target.value }))}/></label>
          <label>Ordem<input type="number" min="0" value={form.position} onChange={e => setForm(v => ({ ...v, position: e.target.value }))}/></label>
          <label>Características<input placeholder="Editorial, Imagem, Texto" value={form.tagsText} onChange={e => setForm(v => ({ ...v, tagsText: e.target.value }))}/></label>
        </div>
        <label className="studio-manager-publish"><input type="checkbox" checked={form.isPublished} onChange={e => setForm(v => ({ ...v, isPublished: e.target.checked }))}/> Publicar na página do estúdio</label>
        <div className="studio-manager-form-actions"><button type="button" onClick={() => setForm(null)}>Cancelar</button><button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar modelo'}</button></div>
      </form>
    </div>}
  </main>
}
