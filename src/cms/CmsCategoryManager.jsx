import { useCallback, useEffect, useState } from 'react'

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
      ...(options.body ? { 'Content-Type': 'application/json', 'X-CSRFToken': readCsrf() } : {}),
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
    }
    throw new Error(messages[data.error] || 'Não foi possível salvar as categorias.')
  }
  return data
}

export function CmsCategoryManager({ onChanged }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null)
  const [title, setTitle] = useState('')
  const [key, setKey] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await categoryRequest('/api/cms/categories/')
      setItems(result.results || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const reset = () => {
    setEditing(null)
    setTitle('')
    setKey('')
    setNotice('')
  }

  const startEdit = item => {
    setEditing(item)
    setTitle(item.title)
    setKey(item.key)
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
          body: JSON.stringify({ title, key }),
        })
        setNotice('Categoria atualizada.')
      } else {
        await categoryRequest('/api/cms/categories/', {
          method: 'POST',
          body: JSON.stringify({ title, key }),
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
    if (!window.confirm(warning)) return
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
          <p>Desativar uma categoria não apaga as obras vinculadas a ela.</p>
          {loading ? <div className="cms-loading">Carregando categorias…</div> : items.length ? items.map(item => (
            <article className="cms-category-item" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <small>{item.workCount} {item.workCount === 1 ? 'obra vinculada' : 'obras vinculadas'} · /{item.key}</small>
                <span className={'cms-category-status' + (item.active ? '' : ' inactive')}>{item.active ? 'Ativa' : 'Inativa'}</span>
              </div>
              <div className="cms-category-item-actions">
                <button type="button" onClick={() => move(items.indexOf(item), -1)} disabled={saving || items.indexOf(item) === 0}>↑</button>
                <button type="button" onClick={() => move(items.indexOf(item), 1)} disabled={saving || items.indexOf(item) === items.length - 1}>↓</button>
                <button type="button" onClick={() => startEdit(item)} disabled={saving}>Editar</button>
                <button type="button" onClick={() => toggleActive(item)} disabled={saving}>{item.active ? 'Desativar' : 'Ativar'}</button>
                <button type="button" onClick={() => remove(item)} disabled={saving}>Excluir</button>
              </div>
            </article>
          )) : <div className="cms-gallery-empty"><strong>Nenhuma categoria cadastrada</strong><small>Crie a primeira ao lado.</small></div>}
        </section>
        <form className="cms-category-form" onSubmit={save}>
          <div>
            <h2>{editing ? 'Editar categoria' : 'Nova categoria'}</h2>
            <p>O nome aparece no portfólio. A chave identifica a categoria nos endereços e filtros.</p>
          </div>
          <label>Nome da categoria
            <input value={title} onChange={event => setTitle(event.target.value)} maxLength={100} required placeholder="Ex.: Pinturas" />
          </label>
          <label>Chave / endereço
            <input value={key} onChange={event => setKey(event.target.value)} maxLength={50} placeholder="Gerada automaticamente pelo nome" />
          </label>
          <div className="cms-category-form-actions">
            <button className="cms-primary-button" type="submit" disabled={saving || !title.trim()}>{saving ? 'Salvando…' : editing ? 'Salvar categoria' : 'Criar categoria'}</button>
            {editing && <button className="cms-editor-cancel" type="button" onClick={reset} disabled={saving}>Cancelar</button>}
          </div>
          {notice && <div className="cms-category-notice" role="status">{notice}</div>}
        </form>
      </div>
    </>
  )
}
