import { useEffect, useState } from 'react'
import './CmsLayoutManager.css'

const DEFAULTS = {
  content_width: 'standard',
  hero_alignment: 'center',
  hero_size: 'large',
  section_spacing: 'comfortable',
  gallery_columns: '3',
  default_gallery_view: 'lista',
  default_theme: 'escuro',
}

const FIELDS = [
  {
    name: 'content_width', title: 'Largura do conteúdo',
    description: 'Define quanto espaço o conteúdo ocupa em telas maiores.',
    options: [['compact', 'Enxuto', 'Mais foco e respiro lateral'], ['standard', 'Equilibrado', 'Proporção atual do portfólio'], ['wide', 'Amplo', 'Mais espaço para imagens e composições']],
  },
  {
    name: 'hero_alignment', title: 'Alinhamento da apresentação',
    description: 'Escolha como o nome e a frase aparecem no topo.',
    options: [['center', 'Centralizado', 'Composição simétrica'], ['left', 'À esquerda', 'Composição editorial']],
  },
  {
    name: 'hero_size', title: 'Altura da apresentação',
    description: 'Controla o espaço reservado ao cabeçalho inicial.',
    options: [['compact', 'Compacta', 'Chega mais rápido ao conteúdo'], ['large', 'Expandida', 'Dá mais destaque à identidade']],
  },
  {
    name: 'section_spacing', title: 'Espaçamento entre seções',
    description: 'Ajusta o ritmo vertical entre as partes do portfólio.',
    options: [['compact', 'Compacto', 'Mais conteúdo na tela'], ['comfortable', 'Confortável', 'Equilíbrio entre conteúdo e respiro'], ['spacious', 'Generoso', 'Mais espaço entre projetos']],
  },
  {
    name: 'gallery_columns', title: 'Colunas da grade',
    description: 'Número de colunas em telas grandes. Em celulares, a grade continua adaptável.',
    options: [['2', '2 colunas', 'Imagens maiores'], ['3', '3 colunas', 'Equilíbrio entre tamanho e variedade'], ['4', '4 colunas', 'Visão panorâmica do acervo']],
  },
  {
    name: 'default_gallery_view', title: 'Visualização inicial',
    description: 'Define como o visitante encontra as obras ao abrir o portfólio.',
    options: [['lista', 'Lista editorial', 'Obras com mais espaço para contexto'], ['grade', 'Grade visual', 'Acervo em uma composição única']],
  },
  {
    name: 'default_theme', title: 'Tema inicial',
    description: 'Define o tema ao abrir o site. O visitante ainda pode alternar.',
    options: [['escuro', 'Escuro', 'A identidade escura atual'], ['claro', 'Claro', 'Uma apresentação mais luminosa']],
  },
]

function readCookie(name) {
  const prefix = name + '='
  const item = document.cookie.split('; ').find(cookie => cookie.startsWith(prefix))
  return item ? decodeURIComponent(item.slice(prefix.length)) : ''
}

export function CmsLayoutManager() {
  const [settings, setSettings] = useState(DEFAULTS)
  const [saved, setSaved] = useState(DEFAULTS)
  const [canChange, setCanChange] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/cms/layout/', { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(response.status === 403 ? 'Sua conta não tem permissão para acessar as opções de layout.' : 'Não foi possível carregar as opções de layout.')
        return data
      })
      .then(data => {
        if (!active) return
        const next = { ...DEFAULTS, ...(data.settings || {}) }
        setSettings(next)
        setSaved(next)
        setCanChange(Boolean(data.permissions?.canChange))
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(saved)
  const change = (name, value) => {
    setSettings(current => ({ ...current, [name]: value }))
    setError('')
    setNotice('')
  }

  const save = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/cms/layout/', {
        method: 'PATCH',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
        body: JSON.stringify(settings),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error === 'layout_edit_permission_required' ? 'Sua conta não tem permissão para alterar o layout.' : 'Não foi possível salvar o layout. Tente novamente.')
      setSettings(data.settings)
      setSaved(data.settings)
      setNotice('Layout salvo. As novas escolhas serão aplicadas ao portfólio público.')
    } catch (err) {
      setError(err.message || 'Não foi possível salvar o layout.')
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    setSettings(saved)
    setError('')
    setNotice('Alterações descartadas.')
  }

  const reset = () => {
    setSettings(DEFAULTS)
    setError('')
    setNotice('')
  }

  if (loading) return <div className="cms-loading">Carregando opções de layout…</div>
  if (error && !canChange && !saved) return <div className="cms-error" role="alert">{error}</div>

  return (
    <section className="cms-layout-page">
      <header className="cms-library-heading">
        <div>
          <p className="cms-eyebrow">APARÊNCIA DO PORTFÓLIO</p>
          <h1>Layout<span>.</span></h1>
          <p>Personalize a composição do site sem mexer nas obras ou no conteúdo.</p>
        </div>
        <a className="cms-secondary-link" href="/" target="_blank" rel="noreferrer">Ver site ↗</a>
      </header>

      <div className="cms-layout-intro">
        <span className="cms-layout-intro-mark" aria-hidden="true">✳</span>
        <div><strong>Seu portfólio, sua composição</strong><p>As opções alteram a apresentação do site. Elas não mudam o conteúdo cadastrado e podem ser ajustadas novamente quando quiser.</p></div>
      </div>

      <form className="cms-layout-form" onSubmit={save}>
        <div className="cms-save-state" role="status" aria-live="polite">
          <span className="cms-save-state-dot" />
          {hasChanges ? 'Você tem alterações não salvas.' : 'Tudo salvo. O layout está atualizado.'}
        </div>
        <div className="cms-layout-fields">
          {FIELDS.map(field => (
            <fieldset className="cms-layout-field" key={field.name} disabled={!canChange || saving}>
              <legend>{field.title}</legend>
              <p>{field.description}</p>
              <div className="cms-layout-options">
                {field.options.map(([value, label, detail]) => (
                  <label className={'cms-layout-option' + (settings[field.name] === value ? ' selected' : '')} key={value}>
                    <input type="radio" name={field.name} value={value} checked={settings[field.name] === value} onChange={() => change(field.name, value)} />
                    <span className="cms-layout-option-copy"><strong>{label}</strong><small>{detail}</small></span>
                    <span className="cms-layout-option-check" aria-hidden="true">✓</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        {error && <div className="cms-editor-message error" role="alert">{error}</div>}
        {notice && <div className="cms-editor-message success" role="status">{notice}</div>}
        <div className="cms-editor-actions">
          <span>{canChange ? 'As alterações serão refletidas no portfólio público após salvar.' : 'Você tem acesso de leitura às opções de layout.'}</span>
          <div className="cms-editor-save-actions">
            <button className="cms-editor-cancel" type="button" onClick={discard} disabled={!hasChanges || saving}>Descartar</button>
            <button className="cms-editor-cancel" type="button" onClick={reset} disabled={!canChange || saving || !hasChanges}>Restaurar padrão</button>
            <button className="cms-primary-button" type="submit" disabled={!canChange || saving || !hasChanges}>{saving ? 'Salvando…' : 'Salvar layout'} <span>↗</span></button>
          </div>
        </div>
      </form>
    </section>
  )
}
