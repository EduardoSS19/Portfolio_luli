import { useCallback, useEffect, useState } from 'react'
import { useCmsConfirm } from './useCmsConfirm.jsx'

const CATEGORY_ANIMATIONS = [
  { value: 'obra', label: 'Editorial', detail: 'Entrada discreta e elegante.' },
  { value: 'ceramica', label: 'Cerâmica', detail: 'A imagem ganha forma como no torno.' },
  { value: 'gravura', label: 'Gravura', detail: 'Revelação vertical com passagem de rolo.' },
  { value: 'desenho', label: 'Desenho', detail: 'Traço revelado da esquerda para a direita.' },
  { value: 'glitch', label: 'Glitch', detail: 'Aparição digital fragmentada.' },
  { value: 'fotografia', label: 'Fotografia', detail: 'Revelação gradual de uma imagem.' },
  { value: 'videoarte', label: 'Videoarte', detail: 'Abertura cinematográfica.' },
  { value: 'suave', label: 'Aparição suave', detail: 'Opacidade que cresce sem deslocamento.' },
  { value: 'deslizar', label: 'Deslizar', detail: 'Movimento curto vindo de baixo.' },
  { value: 'zoom', label: 'Zoom', detail: 'Aproximação sutil até o tamanho natural.' },
  { value: 'recorte', label: 'Revelação por recorte', detail: 'A seção aparece como uma cortina.' },
  { value: 'flutuar', label: 'Flutuação', detail: 'Entrada leve com movimento orgânico.' },
  { value: 'nenhuma', label: 'Sem animação', detail: 'Conteúdo estático, sem efeitos de entrada.' },
]

function readCsrf() {
  const cookie = document.cookie.split('; ').find(item => item.startsWith('csrftoken='))
  return cookie ? decodeURIComponent(cookie.slice('csrftoken='.length)) : ''
}

async function categoryRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.method && options.method !== 'GET' ? { 'X-CSRFToken': readCsrf() } : {}),
      ...options.headers,
    },
    ...options,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const messages = {
      category_add_permission_required: 'Sua conta não tem permissão para criar categorias.',
      category_edit_permission_required: 'Sua conta não tem permissão para editar categorias.',
      category_key_conflict: 'Já existe uma categoria com essa chave.',
      invalid_category_animation: 'Escolha uma animação disponível para esta categoria.',
    }
    throw new Error(messages[data.error] || 'Não foi possível salvar as categorias.')
  }
  return data
}

export function CmsCategoryManager({
  onChanged,
  canEditWorks = false,
  canCreateCategory = false,
  canEditCategory = false,
  canDeleteCategory = false,
}) {
  const { confirm, dialogNode } = useCmsConfirm()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null)
  const [title, setTitle] = useState('')
  const [key, setKey] = useState('')
  const [animation, setAnimation] = useState('obra')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [categoryWorks, setCategoryWorks] = useState([])
  const [savedCategoryWorks, setSavedCategoryWorks] = useState([])
  const [previewing, setPreviewing] = useState(false)
  const [worksLoading, setWorksLoading] = useState(false)
  const [workQuery, setWorkQuery] = useState('')
  const [workPage, setWorkPage] = useState(0)
  const [draggingWorkId, setDraggingWorkId] = useState(null)
  const [dragOverWorkId, setDragOverWorkId] = useState(null)
  const [draggingCategoryId, setDraggingCategoryId] = useState(null)
  const [dragOverCategoryId, setDragOverCategoryId] = useState(null)
  const [supportsDrag, setSupportsDrag] = useState(false)
  const WORKS_PER_PAGE = 10

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setSupportsDrag(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await categoryRequest('/api/cms/categories/')
      setItems(result.results || [])
      setSelectedCategoryId(current => current || String(result.results?.[0]?.id || ''))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const loadCategoryWorks = useCallback(async categoryId => {
    if (!categoryId) { setCategoryWorks([]); return }
    setWorksLoading(true)
    try {
      const key = items.find(item => String(item.id) === String(categoryId))?.key || ''
      let offset = 0
      let all = []
      let hasMore = true
      while (hasMore) {
        const result = await categoryRequest('/api/cms/works/?category=' + encodeURIComponent(key) + '&limit=50&offset=' + offset + '&status=all')
        all = all.concat(result.results || [])
        hasMore = Boolean(result.pagination?.hasMore)
        offset += result.pagination?.limit || 50
      }
      setCategoryWorks(all)
      setSavedCategoryWorks(all)
    } catch (err) { setError(err.message) }
    finally { setWorksLoading(false) }
  }, [items])

  useEffect(() => { loadCategoryWorks(selectedCategoryId); setWorkPage(0); setWorkQuery('') }, [selectedCategoryId, loadCategoryWorks])

  const filteredWorks = categoryWorks.filter(work => (work.title || '').toLocaleLowerCase('pt-BR').includes(workQuery.trim().toLocaleLowerCase('pt-BR')))
  const totalWorkPages = Math.max(1, Math.ceil(filteredWorks.length / WORKS_PER_PAGE))
  const visibleWorks = filteredWorks.slice(workPage * WORKS_PER_PAGE, (workPage + 1) * WORKS_PER_PAGE)

  const hasOrderChanges = categoryWorks.length === savedCategoryWorks.length && categoryWorks.some((item, index) => item.id !== savedCategoryWorks[index]?.id)

  const persistWorkOrder = next => {
    setCategoryWorks(next)
    setNotice('Ordem alterada localmente. Salve para aplicar no portfólio.')
    setError('')
    setDraggingWorkId(null)
    setDragOverWorkId(null)
  }

  const saveWorkOrder = async () => {
    if (!hasOrderChanges || !selectedCategoryId) return
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await categoryRequest('/api/cms/categories/' + selectedCategoryId + '/works/order/', {
        method: 'POST', body: JSON.stringify({ workIds: categoryWorks.map(item => item.id) }),
      })
      const refreshed = response.results || categoryWorks
      setCategoryWorks(refreshed)
      setSavedCategoryWorks(refreshed)
      setNotice('Nova organização salva e publicada no portfólio.')
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  const discardWorkOrder = () => {
    setCategoryWorks(savedCategoryWorks)
    setNotice('Alterações descartadas. A ordem salva foi restaurada.')
    setError('')
  }

  const previewWorkOrder = async () => {
    if (!selectedCategoryId) return
    const previewWindow = window.open('about:blank', '_blank')
    if (!previewWindow) {
      setError('O navegador bloqueou a nova aba. Permita pop-ups para abrir a prévia.')
      return
    }
    setPreviewing(true); setError('')
    try {
      const response = await categoryRequest('/api/cms/categories/' + selectedCategoryId + '/works/preview/', {
        method: 'POST', body: JSON.stringify({ workIds: categoryWorks.map(item => item.id) }),
      })
      previewWindow.location = response.url
      setNotice('Prévia aberta. O link temporário pode ser compartilhado com o cliente por 10 minutos.')
    } catch (err) {
      previewWindow.close()
      setError(err.message)
    } finally { setPreviewing(false) }
  }

  const moveWork = (index, direction) => {
    const next = [...categoryWorks]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    persistWorkOrder(next)
  }

  const dropWork = targetId => {
    if (!draggingWorkId || draggingWorkId === targetId || workQuery.trim()) return
    const sourceIndex = categoryWorks.findIndex(item => String(item.id) === String(draggingWorkId))
    const targetIndex = categoryWorks.findIndex(item => String(item.id) === String(targetId))
    if (sourceIndex < 0 || targetIndex < 0) return
    const next = [...categoryWorks]
    const [dragged] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, dragged)
    persistWorkOrder(next)
  }

  const reset = () => {
    setEditing(null)
    setTitle('')
    setKey('')
    setAnimation('obra')
    setNotice('')
  }

  const startEdit = item => {
    setEditing(item)
    setTitle(item.title)
    setKey(item.key)
    setAnimation(item.animation || 'obra')
    setError('')
    setNotice('')
  }

  const save = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (editing) {
        await categoryRequest('/api/cms/categories/' + editing.id + '/', {
          method: 'POST',
          body: JSON.stringify({ title, key, animation }),
        })
        setNotice('Categoria atualizada.')
      } else {
        await categoryRequest('/api/cms/categories/', {
          method: 'POST',
          body: JSON.stringify({ title, key, animation }),
        })
        setNotice('Categoria criada.')
      }
      reset()
      await load()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const dropCategory = async targetId => {
    if (!draggingCategoryId || draggingCategoryId === targetId) return
    const sourceIndex = items.findIndex(item => String(item.id) === String(draggingCategoryId))
    const targetIndex = items.findIndex(item => String(item.id) === String(targetId))
    if (sourceIndex < 0 || targetIndex < 0) return
    const next = [...items]
    const [dragged] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, dragged)
    setDraggingCategoryId(null)
    setDragOverCategoryId(null)
    setSaving(true); setError('')
    try {
      const result = await categoryRequest('/api/cms/categories/', {
        method: 'PATCH',
        body: JSON.stringify({ ids: next.map(item => item.id) }),
      })
      setItems(result.results || next)
      setNotice('Ordem das categorias atualizada.')
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const move = async (index, direction) => {
    const next = [...items]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setSaving(true)
    setError('')
    try {
      const result = await categoryRequest('/api/cms/categories/', {
        method: 'PATCH',
        body: JSON.stringify({ ids: next.map(item => item.id) }),
      })
      setItems(result.results || [])
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async item => {
    const warning = item.workCount
      ? 'Excluir esta categoria também excluirá permanentemente ' + item.workCount + ' obra(s) vinculada(s). Continuar?'
      : 'Excluir esta categoria permanentemente?'
    if (!(await confirm({ title: 'Excluir categoria?', message: warning + ' Esta ação não pode ser desfeita.', target: item.title, confirmLabel: 'Excluir categoria', variant: 'danger' }))) return
    setSaving(true); setError(''); setNotice('')
    try {
      await categoryRequest('/api/cms/categories/' + item.id + '/', { method: 'DELETE' })
      if (editing === item.id) reset()
      setNotice('Categoria excluída.')
      await load()
      onChanged?.()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const toggleActive = async item => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await categoryRequest('/api/cms/categories/' + item.id + '/', {
        method: 'POST',
        body: JSON.stringify({ active: !item.active }),
      })
      setNotice(item.active ? 'Categoria desativada. As obras foram preservadas.' : 'Categoria ativada.')
      await load()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className="cms-library-heading">
        <div>
          <p className="cms-eyebrow">ORGANIZAÇÃO DO ACERVO</p>
          <h1>Categorias<span>.</span></h1>
          <p>Organize as áreas do seu trabalho sem mexer nas obras já cadastradas.</p>
        </div>
      </section>
      {error && <div className="cms-error" role="alert">{error}<button type="button" onClick={load}>Tentar novamente</button></div>}
      <div className="cms-category-page">
        <section className="cms-category-list">
          <h2>Suas categorias</h2>
          <p>Para definir a animação, clique em <strong>Editar</strong> na categoria desejada e escolha uma opção na lista. Desativar uma categoria não apaga suas obras.</p>
          {loading ? <div className="cms-loading">Carregando categorias…</div> : items.length ? items.map(item => (
            <article
              className={'cms-category-item' + (draggingCategoryId === item.id ? ' is-dragging' : '') + (dragOverCategoryId === item.id ? ' is-drop-target' : '')}
              key={item.id}
              draggable={supportsDrag && canEditCategory && !saving}
              onDragStart={event => {
                if (!supportsDrag || !canEditCategory || saving) { event.preventDefault(); return }
                setDraggingCategoryId(item.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', String(item.id))
              }}
              onDragOver={event => {
                if (!draggingCategoryId || !canEditCategory || saving) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                if (dragOverCategoryId !== item.id) setDragOverCategoryId(item.id)
              }}
              onDrop={event => { event.preventDefault(); dropCategory(item.id) }}
              onDragEnd={() => { setDraggingCategoryId(null); setDragOverCategoryId(null) }}
            >
              <div>
                <strong>{supportsDrag && canEditCategory && <span className="cms-category-drag-handle" aria-hidden="true" title="Arraste para reorganizar">⠿ </span>}{item.title}</strong>
                <small>{item.workCount} {item.workCount === 1 ? 'obra vinculada' : 'obras vinculadas'} · /{item.key} · Animação: {CATEGORY_ANIMATIONS.find(option => option.value === item.animation)?.label || 'Editorial'}</small>
                <span className={'cms-category-status' + (item.active ? '' : ' inactive')}>{item.active ? 'Ativa' : 'Inativa'}</span>
              </div>
              <div className="cms-category-item-actions">
                <button type="button" onClick={() => setSelectedCategoryId(String(item.id))} disabled={saving || !canEditWorks} title={!canEditWorks ? 'Sua conta não tem permissão para reorganizar obras.' : 'Organizar a ordem das obras nesta categoria'}>Organizar obras</button>
                {canEditCategory && <>
                  <button type="button" onClick={() => move(items.indexOf(item), -1)} disabled={saving || items.indexOf(item) === 0} aria-label={'Mover categoria ' + item.title + ' para cima'}>↑</button>
                  <button type="button" onClick={() => move(items.indexOf(item), 1)} disabled={saving || items.indexOf(item) === items.length - 1} aria-label={'Mover categoria ' + item.title + ' para baixo'}>↓</button>
                  <button type="button" onClick={() => startEdit(item)} disabled={saving}>Editar</button>
                  <button type="button" onClick={() => toggleActive(item)} disabled={saving}>{item.active ? 'Desativar' : 'Ativar'}</button>
                </>}
                {canDeleteCategory && <button type="button" onClick={() => remove(item)} disabled={saving}>Excluir</button>}
              </div>
            </article>
          )) : <div className="cms-gallery-empty"><strong>Nenhuma categoria cadastrada</strong><small>Crie a primeira ao lado.</small></div>}
        </section>
        <section className="cms-category-work-order">
          <div className="cms-category-work-order-heading"><div><h2>Ordem das obras</h2><p>Esta sequência define como as obras aparecem dentro da categoria no portfólio. Use as setas para mover uma obra; em computadores, também é possível arrastar.</p></div>
            <select aria-label="Categoria para organizar obras" value={selectedCategoryId} onChange={event => setSelectedCategoryId(event.target.value)}>
              <option value="">Selecione uma categoria</option>
              {items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </div>
          {worksLoading ? <div className="cms-loading">Carregando obras…</div> : categoryWorks.length ? (
            <>
              <div className="cms-category-order-actions">
                <span>{hasOrderChanges ? 'Você tem alterações não salvas.' : 'Ordem salva no portfólio.'}</span>
                <div>
                  <button type="button" onClick={previewWorkOrder} disabled={previewing || saving}>{previewing ? 'Preparando…' : 'Visualizar prévia ↗'}</button>
                  <button type="button" onClick={discardWorkOrder} disabled={!hasOrderChanges || saving}>Descartar</button>
                  <button type="button" className="cms-primary-button" onClick={saveWorkOrder} disabled={!hasOrderChanges || saving}>{saving ? 'Salvando…' : 'Salvar organização'}</button>
                </div>
              </div>
              <label className="cms-category-work-search">Buscar obra nesta categoria
                <input type="search" value={workQuery} onChange={event => { setWorkQuery(event.target.value); setWorkPage(0) }} placeholder="Digite o nome da obra…" />
              </label>
              {supportsDrag && !workQuery.trim() && <p className="cms-category-drag-hint">⠿ Arraste as miniaturas para definir a ordem. As setas continuam disponíveis como alternativa.</p>}
              {workQuery.trim() && supportsDrag && <p className="cms-category-drag-hint">Limpe a busca para reorganizar visualmente as obras.</p>}
              {visibleWorks.length ? visibleWorks.map(work => {
                const index = categoryWorks.findIndex(item => item.id === work.id)
                const canDrag = supportsDrag && !workQuery.trim() && canEditWorks && !saving
                return <article
                  className={'cms-category-work-row cms-category-work-card' + (draggingWorkId === work.id ? ' is-dragging' : '') + (dragOverWorkId === work.id ? ' is-drop-target' : '')}
                  key={work.id}
                  draggable={canDrag}
                  onDragStart={event => {
                    if (!canDrag) { event.preventDefault(); return }
                    setDraggingWorkId(work.id)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', String(work.id))
                  }}
                  onDragOver={event => {
                    if (!draggingWorkId || workQuery.trim()) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    if (dragOverWorkId !== work.id) setDragOverWorkId(work.id)
                  }}
                  onDrop={event => { event.preventDefault(); dropWork(work.id) }}
                  onDragEnd={() => { setDraggingWorkId(null); setDragOverWorkId(null) }}
                >
                  <span className="cms-category-work-position">{String(index + 1).padStart(2, '0')}</span>
                  <div className="cms-category-work-thumb">
                    {work.image ? <img src={work.image} alt="" loading="lazy" /> : <span>✳</span>}
                  </div>
                  <div className="cms-category-work-info">
                    <strong>{work.title}</strong>
                    <span className={'cms-category-status' + (work.published ? '' : ' inactive')}>{work.published ? 'Publicada' : 'Rascunho'}</span>
                  </div>
                  {supportsDrag && <span className="cms-category-drag-handle" aria-hidden="true" title="Arraste para reorganizar">⠿</span>}
                  <div className="cms-category-work-move-buttons"><button type="button" aria-label={'Mover ' + work.title + ' para cima'} disabled={saving || !canEditWorks || index === 0} onClick={() => moveWork(index, -1)}>↑</button><button type="button" aria-label={'Mover ' + work.title + ' para baixo'} disabled={saving || !canEditWorks || index === categoryWorks.length - 1} onClick={() => moveWork(index, 1)}>↓</button></div>
                </article>
              }) : <div className="cms-gallery-empty"><strong>Nenhuma obra encontrada</strong><small>Tente outro termo de busca.</small></div>}
              <div className="cms-category-work-pagination">
                <span>{filteredWorks.length} {filteredWorks.length === 1 ? 'obra encontrada' : 'obras encontradas'} · Página {workPage + 1} de {totalWorkPages}</span>
                <div><button type="button" onClick={() => setWorkPage(value => Math.max(0, value - 1))} disabled={workPage === 0}>← Anterior</button><button type="button" onClick={() => setWorkPage(value => Math.min(totalWorkPages - 1, value + 1))} disabled={workPage >= totalWorkPages - 1}>Próxima →</button></div>
              </div>
            </>
          ) : <div className="cms-gallery-empty"><strong>{selectedCategoryId ? 'Nenhuma obra nesta categoria' : 'Selecione uma categoria'}</strong><small>Use a busca para localizar uma obra ou as setas para reorganizar a sequência.</small></div>}
        </section>
        {(canCreateCategory || (editing && canEditCategory)) ? <form className="cms-category-form" onSubmit={save}>
          <div>
            <h2>{editing ? 'Editar categoria' : 'Nova categoria'}</h2>
            <p>O nome aparece no portfólio. A chave identifica a categoria nos endereços e filtros.</p>
          </div>
          <label>Nome da categoria
            <input value={title} onChange={event => setTitle(event.target.value)} maxLength={100} required placeholder="Ex.: Pinturas" />
            <small className="cms-field-help">Nome que os visitantes verão para encontrar este grupo de obras.</small>
          </label>
          <label>Chave / endereço
            <input value={key} onChange={event => setKey(event.target.value)} maxLength={50} placeholder="Gerada automaticamente pelo nome" />
            <small className="cms-field-help">Identificador usado no endereço e nos filtros. Se não souber, deixe em branco para gerar automaticamente.</small>
          </label>
          <fieldset className="cms-category-animation-field">
            <legend>Animação desta categoria</legend>
            <p className="cms-field-help">Cada categoria tem sua própria animação. Escolha uma opção na lista e confira o exemplo antes de salvar.</p>
            <label className="cms-category-animation-select">Escolher animação
              <select
                value={animation}
                onChange={event => setAnimation(event.target.value)}
                disabled={saving}
              >
                {CATEGORY_ANIMATIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <div className="cms-category-animation-preview" aria-live="polite">
              <div className="cms-category-animation-preview-heading">
                <strong>{CATEGORY_ANIMATIONS.find(option => option.value === animation)?.label || 'Editorial'}</strong>
                <small>{CATEGORY_ANIMATIONS.find(option => option.value === animation)?.detail || 'Entrada discreta e elegante.'}</small>
              </div>
              <div className="cms-animation-demo" data-animation={animation} aria-label={'Exemplo da animação ' + (CATEGORY_ANIMATIONS.find(option => option.value === animation)?.label || 'Editorial')}>
                <i /><i /><i />
              </div>
            </div>
          </fieldset>
          <div className="cms-category-form-actions">
            <button className="cms-primary-button" type="submit" disabled={saving || !title.trim() || (editing ? !canEditCategory : !canCreateCategory)}>{saving ? 'Salvando…' : editing ? 'Salvar categoria' : 'Criar categoria'}</button>
            {editing && <button className="cms-editor-cancel" type="button" onClick={reset} disabled={saving}>Cancelar</button>}
          </div>
          {notice && <div className="cms-category-notice" role="status">{notice}</div>}
        </form> : <aside className="cms-category-form cms-permission-note" role="note">
          <h2>Permissões de categoria</h2>
          <p>{canEditCategory ? 'Sua conta pode editar categorias existentes, mas não criar novas categorias.' : 'Sua conta pode consultar o acervo, mas não tem autorização para criar ou editar categorias.'}</p>
        </aside>}
      </div>
      {dialogNode}
    </>
  )
}
