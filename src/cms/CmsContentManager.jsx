import { useCallback, useEffect, useState } from 'react'

const TYPES = [
  { id: 'social-links', label: 'Redes sociais', title: 'Redes sociais', description: 'Links como Instagram e Behance exibidos junto aos contatos no rodapé do site.' },
  { id: 'references', label: 'Referências', title: 'Referências', description: 'Registros exibidos na seção Referências do portfólio, com período e links para clientes, publicações, exposições ou projetos.' },
  { id: 'backgrounds', label: 'Imagens de fundo', title: 'Imagens de fundo', description: 'Gerencie as imagens que formam o fundo visual do site. A ordem define a sequência em que aparecem.' },
]

function csrf() {
  const item = document.cookie.split('; ').find(value => value.startsWith('csrftoken='))
  return item ? decodeURIComponent(item.slice('csrftoken='.length)) : ''
}

async function api(url, options = {}) {
  const headers = { Accept: 'application/json', ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(options.method && options.method !== 'GET' ? { 'X-CSRFToken': csrf() } : {}), ...options.headers }
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const messages = {
      content_view_permission_required: 'Sua conta não tem permissão para visualizar este conteúdo.',
      content_add_permission_required: 'Sua conta não tem permissão para adicionar este conteúdo.',
      content_change_permission_required: 'Sua conta não tem permissão para editar este conteúdo.',
      content_delete_permission_required: 'Sua conta não tem permissão para excluir este conteúdo.',
      validation_error: 'Confira os campos informados.',
      image_too_large: 'Cada imagem deve ter no máximo 15 MB.',
      unsupported_image_format: 'Use imagens JPG, PNG ou WebP.',
      invalid_image_file: 'Um dos arquivos não é uma imagem válida.',
    }
    const fieldMessages = Object.values(data.fields || {}).flatMap(value => Array.isArray(value) ? value : []).map(value => value.message || value).filter(Boolean)
    throw new Error(fieldMessages.join(' · ') || messages[data.error] || 'Não foi possível concluir a operação.')
  }
  return data
}

const emptyForm = type => type === 'social-links'
  ? { title: '', url: '', position: 0, is_active: true }
  : { title: '', period: '', position: 0, is_active: true, links: [] }

export function CmsContentManager() {
  const [type, setType] = useState('social-links')
  const [items, setItems] = useState([])
  const [permissions, setPermissions] = useState({})
  const [form, setForm] = useState(emptyForm('social-links'))
  const [editing, setEditing] = useState(null)
  const [files, setFiles] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [previewBackground, setPreviewBackground] = useState(null)
  const [imageErrors, setImageErrors] = useState({})

  const load = useCallback(async (kind = type) => {
    setLoading(true)
    setError('')
    try {
      const result = await api('/api/cms/content/?type=' + kind)
      setItems(result.results || [])
      setPermissions(result.permissions || {})
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [type])

  useEffect(() => { setEditing(null); setForm(emptyForm(type)); setFiles([]); setSelectedIds([]); load(type) }, [type, load])

  const reset = () => { setEditing(null); setForm(emptyForm(type)); setNotice('') }
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const startEdit = item => {
    setEditing(item.id)
    setForm(type === 'references'
      ? { title: item.title, period: item.period || '', position: item.position, is_active: item.active, links: item.links.map(link => ({ text: link.text, url: link.url })) }
      : { title: item.title, url: item.url, position: item.position, is_active: item.active })
    setError('')
    setNotice('')
  }

  const save = async event => {
    event.preventDefault()
    setSaving(true); setError(''); setNotice('')
    try {
      const payload = { ...form, type }
      await api(editing ? '/api/cms/content/' + type + '/' + editing + '/' : '/api/cms/content/?type=' + type, {
        method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload),
      })
      setNotice(editing ? 'Alterações salvas.' : 'Item adicionado.')
      reset()
      await load(type)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const uploadBackgrounds = async event => {
    event.preventDefault()
    if (!files.length) return
    setSaving(true); setError(''); setNotice('')
    try {
      const body = new FormData()
      files.forEach(file => body.append('images', file))
      await api('/api/cms/content/?type=backgrounds', { method: 'POST', body })
      setFiles([])
      setNotice('Imagens adicionadas na ordem selecionada.')
      await load('backgrounds')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const replaceBackground = async (item, file) => {
    if (!file) return
    setSaving(true); setError(''); setNotice('')
    try {
      const body = new FormData()
      body.append('image', file)
      await api('/api/cms/content/backgrounds/' + item.id + '/', { method: 'PATCH', body })
      setImageErrors(current => ({ ...current, [item.id]: false }))
      setNotice('Imagem de fundo substituída. A posição e a publicação foram preservadas.')
      await load('backgrounds')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const toggle = async item => {
    setSaving(true); setError(''); setNotice('')
    try {
      await api('/api/cms/content/' + type + '/' + item.id + '/toggle/', { method: 'POST' })
      await load(type)
      setNotice(item.active ? 'Item desativado sem apagar seus dados.' : 'Item ativado.')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const remove = async item => {
    if (!window.confirm('Excluir este item permanentemente?')) return
    setSaving(true); setError(''); setNotice('')
    try {
      await api('/api/cms/content/' + type + '/' + item.id + '/', { method: 'DELETE' })
      await load(type)
      if (editing === item.id) reset()
      setNotice('Item excluído.')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const bulkToggle = async active => {
    if (!selectedIds.length) return
    setSaving(true); setError(''); setNotice('')
    try {
      await api('/api/cms/content/', { method: 'PATCH', body: JSON.stringify({ type, ids: selectedIds, active }) })
      setSelectedIds([])
      await load(type)
      setNotice(active ? 'Itens selecionados publicados.' : 'Itens selecionados ocultados sem apagar seus dados.')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const move = async (index, delta) => {
    const next = [...items]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setSaving(true); setError('')
    try {
      await api('/api/cms/content/', { method: 'PATCH', body: JSON.stringify({ type, ids: next.map(item => item.id) }) })
      await load(type)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const addLink = () => update('links', [...(form.links || []), { text: '', url: '' }])
  const editLink = (index, key, value) => update('links', (form.links || []).map((link, i) => i === index ? { ...link, [key]: value } : link))
  const removeLink = index => update('links', (form.links || []).filter((_, i) => i !== index))

  const current = TYPES.find(item => item.id === type)
  const canEdit = permissions.canAdd || permissions.canChange

  return (
    <section className="cms-content-manager">
      <header className="cms-library-heading">
        <div><p className="cms-eyebrow">ELEMENTOS COMPLEMENTARES DO SITE</p><h1>Conteúdo complementar<span>.</span></h1><p>Esta área não cadastra obras: ela controla os links do rodapé, a seção Referências e as imagens de fundo do portfólio.</p></div>
      </header>
      <nav className="cms-content-tabs" aria-label="Tipos de conteúdo">
        {TYPES.map(item => <button type="button" key={item.id} className={type === item.id ? 'active' : ''} onClick={() => { setItems([]); setType(item.id) }}>{item.label}</button>)}
      </nav>
      <div className="cms-content-intro"><div><h2>{current.title}</h2><p>{current.description}</p></div><span>{items.length} {items.length === 1 ? 'item' : 'itens'}</span></div>
      {error && <div className="cms-error" role="alert">{error}<button type="button" onClick={() => load(type)}>Tentar novamente</button></div>}
      {notice && <div className="cms-editor-message success" role="status">{notice}</div>}
      {selectedIds.length > 0 && <div className="cms-bulk-actions"><strong>{selectedIds.length} item(ns) selecionado(s)</strong><button type="button" onClick={() => bulkToggle(true)} disabled={saving}>Publicar selecionados</button><button type="button" onClick={() => bulkToggle(false)} disabled={saving}>Ocultar selecionados</button><button type="button" onClick={() => setSelectedIds([])}>Limpar seleção</button></div>}
      <div className="cms-content-layout">
        <section className="cms-content-list">
          {loading ? <div className="cms-loading">Carregando conteúdo…</div> : items.length ? items.map((item, index) => (
            <article className="cms-content-item" key={item.id}>
              <label className="cms-content-select"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} aria-label={'Selecionar ' + (item.title || 'imagem de fundo')} /> Selecionar</label>
              {type === 'backgrounds' && (item.image && !imageErrors[item.id]
                ? <button type="button" className="cms-background-preview" onClick={() => setPreviewBackground(item)} aria-label={'Visualizar imagem de fundo ' + (index + 1)}>
                    <img className="cms-content-thumb" src={item.image} alt={'Prévia da imagem de fundo ' + (index + 1)} loading="eager" decoding="async" onError={() => setImageErrors(current => ({ ...current, [item.id]: true }))} />
                  </button>
                : <span className="cms-background-image-fallback">Prévia indisponível</span> )}
              <div className="cms-content-item-main">
                <strong>{type === 'backgrounds' ? 'Imagem de fundo ' + (index + 1) : item.title}</strong>
                <small>{type === 'social-links' ? item.url : type === 'references' ? [item.period, (item.links || []).length + ' links'].filter(Boolean).join(' · ') : 'Posição ' + (item.position + 1)}</small>
                <span className={'cms-category-status' + (item.active ? '' : ' inactive')}>{item.active ? 'Ativo' : 'Inativo'}</span>
              </div>
              <div className="cms-content-item-actions">
                <button type="button" aria-label="Mover para cima" disabled={saving || index === 0 || !permissions.canChange} onClick={() => move(index, -1)}>↑</button>
                <button type="button" aria-label="Mover para baixo" disabled={saving || index === items.length - 1 || !permissions.canChange} onClick={() => move(index, 1)}>↓</button>
                {type === 'backgrounds' && <label className="cms-background-replace" title="Substituir o arquivo sem alterar a posição">
                  Substituir<input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving || !permissions.canChange} onChange={event => { replaceBackground(item, event.target.files?.[0]); event.target.value = '' }} />
                </label>}
                {type !== 'backgrounds' && <button type="button" onClick={() => startEdit(item)} disabled={saving || !permissions.canChange}>Editar</button>}
                <button type="button" onClick={() => toggle(item)} disabled={saving || !permissions.canChange}>{item.active ? 'Ocultar' : 'Publicar'}</button>
                <button type="button" onClick={() => remove(item)} disabled={saving || !permissions.canDelete}>Excluir</button>
              </div>
            </article>
          )) : <div className="cms-gallery-empty"><strong>Nenhum item cadastrado</strong><small>Adicione o primeiro usando o formulário.</small></div>}
        </section>
        {type === 'backgrounds' ? (
          <form className="cms-content-form" onSubmit={uploadBackgrounds}>
            <h3>Adicionar imagens</h3><p>Selecione várias imagens de uma vez. Elas serão adicionadas ao final da sequência, na ordem dos arquivos.</p>
            <label>Arquivos de imagem<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => setFiles(Array.from(event.target.files || []))} /></label>
            <small className="cms-field-help">Escolha JPG, PNG ou WebP. As imagens entram depois das atuais; use “Substituir” para trocar um arquivo sem mudar sua posição.</small>
            <small>{files.length} arquivo(s) selecionado(s) · até 15 MB por imagem</small>
            <button className="cms-primary-button" type="submit" disabled={saving || !files.length || !permissions.canAdd}>{saving ? 'Enviando…' : 'Adicionar imagens'}</button>
          </form>
        ) : (
          <form className="cms-content-form" onSubmit={save}>
            <h3>{editing ? 'Editar item' : type === 'references' ? 'Nova referência' : 'Novo link social'}</h3>
            <label>{type === 'references' ? 'Título' : 'Nome da rede social'}<input required maxLength={type === 'references' ? 255 : 40} value={form.title} onChange={event => update('title', event.target.value)} placeholder={type === 'references' ? 'Ex.: Exposição coletiva' : 'Ex.: Instagram'} /><small className="cms-field-help">{type === 'references' ? 'Nome da exposição, publicação, cliente ou projeto que deseja destacar.' : 'Nome que será exibido junto ao endereço, como Instagram ou Behance.'}</small></label>
            {type === 'social-links' ? <label>URL<input type="url" required maxLength={500} value={form.url} onChange={event => update('url', event.target.value)} placeholder="https://" /><small className="cms-field-help">Cole o endereço completo do perfil, incluindo https://.</small></label> : <>
              <label>Período<input maxLength={100} value={form.period} onChange={event => update('period', event.target.value)} placeholder="Ex.: 2024–2025" /><small className="cms-field-help">Ano ou intervalo em que a exposição, projeto ou publicação aconteceu.</small></label>
              <div className="cms-content-links"><div><strong>Links da referência</strong><button type="button" onClick={addLink}>+ Adicionar link</button></div>
                {(form.links || []).map((link, index) => <div className="cms-content-link-fields" key={index}><input aria-label="Texto do link" required maxLength={255} placeholder="Texto do link" value={link.text} onChange={event => editLink(index, 'text', event.target.value)} /><input aria-label="URL do link" type="url" required maxLength={500} placeholder="https://" value={link.url} onChange={event => editLink(index, 'url', event.target.value)} /><button type="button" onClick={() => removeLink(index)} aria-label="Remover link">×</button></div>)}
              </div>
            </>}
            <label className="cms-content-checkbox"><input type="checkbox" checked={!!form.is_active} onChange={event => update('is_active', event.target.checked)} /> Publicado no site</label>
            <div className="cms-content-form-actions"><button className="cms-primary-button" type="submit" disabled={saving || !(editing ? permissions.canChange : permissions.canAdd)}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Adicionar item'}</button>{editing && <button type="button" className="cms-editor-cancel" onClick={reset} disabled={saving}>Cancelar</button>}</div>
          </form>
        )}
      </div>
      {previewBackground && <div className="cms-background-preview-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPreviewBackground(null) }}>
        <section className="cms-background-preview-dialog" role="dialog" aria-modal="true" aria-label="Visualização da imagem de fundo">
          <header><div><strong>Imagem de fundo</strong><small>Prévia do arquivo cadastrado no portfólio</small></div><button type="button" onClick={() => setPreviewBackground(null)} aria-label="Fechar visualização">×</button></header>
          {imageErrors[previewBackground.id] ? <p className="cms-background-preview-error">Não foi possível carregar esta imagem. O endereço do arquivo foi recebido, mas o armazenamento não respondeu com uma imagem válida.</p> : <img src={previewBackground.image} alt="Visualização ampliada da imagem de fundo" onError={() => setImageErrors(current => ({ ...current, [previewBackground.id]: true }))} />}
          <footer><span>{imageErrors[previewBackground.id] ? 'Não foi possível carregar este arquivo. Verifique o armazenamento da imagem.' : 'A imagem original foi carregada para conferência.'}</span><button type="button" onClick={() => setPreviewBackground(null)}>Fechar</button></footer>
        </section>
      </div>}
    </section>
  )
}
