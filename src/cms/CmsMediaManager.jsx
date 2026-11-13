import { useCallback, useEffect, useState } from 'react'
import { useCmsConfirm } from './useCmsConfirm.jsx'

function readCookie(name) {
  const prefix = name + '='
  const item = document.cookie.split('; ').find(cookie => cookie.startsWith(prefix))
  return item ? decodeURIComponent(item.slice(prefix.length)) : ''
}

export function CmsMediaManager({ canEdit = false }) {
  const { confirm, dialogNode } = useCmsConfirm()
  const [items, setItems] = useState([])
  const [works, setWorks] = useState([])
  const [type, setType] = useState('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [targets, setTargets] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ type, q: query.trim(), limit: '500' })
      const response = await fetch('/api/cms/media/?' + params.toString(), {
        credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' },
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error === 'staff_required' ? 'Sua conta não tem acesso à biblioteca de mídias.' : 'Não foi possível carregar as mídias.')
      setItems(result.results || [])
      setWorks(result.works || [])
      setTargets(current => {
        const next = { ...current }
        for (const item of result.results || []) if (!(item.id + ':' + item.type in next)) next[item.id + ':' + item.type] = String(item.workId)
        return next
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [type, query])

  useEffect(() => { load() }, [load])

  const move = async item => {
    const key = item.id + ':' + item.type
    const workId = Number(targets[key])
    if (!workId || workId === item.workId) return
    const destination = works.find(work => work.id === workId)
    if (!(await confirm({ title: 'Transferir mídia?', message: '“' + item.title + '” será movida de “' + item.workTitle + '” para “' + (destination?.title || 'a obra selecionada') + '”. O arquivo original será preservado.', target: item.title + ' · destino: ' + (destination?.title || 'obra selecionada'), confirmLabel: 'Transferir mídia', variant: 'default' }))) return
    setBusy(key); setError(''); setNotice('')
    try {
      const response = await fetch('/api/cms/media/move/', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
        body: JSON.stringify({ type: item.type, itemId: item.id, workId }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        const messages = {
          work_edit_permission_required: 'Sua conta não tem permissão para reorganizar mídias.',
          video_already_attached: 'Este vídeo já está vinculado à obra de destino.',
          media_or_work_not_found: 'A mídia ou a obra de destino não foi encontrada.',
          same_work: 'Escolha uma obra diferente da atual.',
        }
        throw new Error(messages[result.error] || 'Não foi possível transferir esta mídia.')
      }
      setNotice('Mídia transferida para "' + result.workTitle + '". O arquivo original foi preservado.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="cms-media-manager">
      <header className="cms-media-heading">
        <div><p className="cms-eyebrow">ORGANIZAÇÃO DO ACERVO</p><h1>Biblioteca de mídias<span>.</span></h1><p>Encontre fotos extras e vídeos vinculados às obras e transfira-os sem reenviar arquivos.</p></div>
      </header>
      <div className="cms-media-tools">
        <input aria-label="Buscar mídia ou obra" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar pelo nome da obra, arquivo ou vídeo…" />
        <select aria-label="Filtrar tipo de mídia" value={type} onChange={event => setType(event.target.value)}>
          <option value="all">Todas as mídias</option><option value="image">Fotos extras</option><option value="video">Vídeos</option>
        </select>
      </div>
      {error && <div className="cms-media-message error" role="alert">{error}</div>}
      {notice && <div className="cms-media-message" role="status">{notice}</div>}
      {loading ? <div className="cms-loading">Carregando biblioteca de mídias…</div> : items.length ? (
        <div className="cms-media-grid">
          {items.map(item => {
            const key = item.id + ':' + item.type
            return <article className="cms-media-item" key={key}>
              <div className={'cms-media-thumb' + (item.type === 'video' ? ' video' : '')}>
                {item.preview ? <img src={item.preview} alt="" loading="lazy" /> : item.type === 'video' ? '▶' : '▧'}
              </div>
              <div className="cms-media-info">
                <span className="cms-media-kind">{item.type === 'image' ? 'Foto extra' : 'YouTube'}</span>
                <strong>{item.title}</strong>
                <small>{item.workTitle} · {item.categoryTitle} · {item.detail}</small>
                {item.youtubeUrl && <a href={item.youtubeUrl} target="_blank" rel="noreferrer">Abrir vídeo ↗</a>}
              </div>
              <select aria-label={'Obra de destino para ' + item.title} value={targets[key] || String(item.workId)} disabled={!canEdit || busy === key} onChange={event => setTargets(current => ({ ...current, [key]: event.target.value }))}>
                {works.map(work => <option key={work.id} value={work.id}>{work.title} · {work.categoryTitle}</option>)}
              </select>
              <button type="button" disabled={!canEdit || busy === key || Number(targets[key] || item.workId) === item.workId} onClick={() => move(item)}>{busy === key ? 'Transferindo…' : 'Transferir'}</button>
            </article>
          })}
        </div>
      ) : <div className="cms-media-empty">Nenhuma mídia encontrada. Fotos extras e vídeos cadastrados nas obras aparecerão aqui.</div>}
      {!canEdit && <small className="cms-field-help">Sua conta pode consultar a biblioteca, mas não tem permissão para transferir mídias.</small>}
      {dialogNode}
    </section>
  )
}
