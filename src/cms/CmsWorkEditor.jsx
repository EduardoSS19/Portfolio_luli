import { useEffect, useState } from 'react'

const SECTIONS = [
  {
    title: 'Identificação',
    description: 'As informações principais que apresentam a obra.',
    fields: [
      { name: 'title', label: 'Nome da obra', required: true },
      { name: 'category', label: 'Categoria', type: 'category', required: true },
      { name: 'year', label: 'Ano de criação', type: 'number', placeholder: 'Ex.: 2024' },
      { name: 'description', label: 'Descrição', type: 'textarea', wide: true, placeholder: 'Conte um pouco sobre esta obra…' },
      { name: 'detail', label: 'Observações adicionais', type: 'textarea', wide: true },
    ],
  },
  {
    title: 'Técnica e materiais',
    description: 'Como a obra foi criada e a qual série pertence.',
    fields: [
      { name: 'technique', label: 'Técnica' },
      { name: 'material', label: 'Materiais' },
      { name: 'support', label: 'Suporte' },
      { name: 'series', label: 'Série ou coleção' },
    ],
  },
  {
    title: 'Dimensões',
    description: 'Preencha somente as medidas que fizerem sentido para a obra.',
    fields: [
      { name: 'height', label: 'Altura', type: 'number', step: '0.01' },
      { name: 'width', label: 'Largura', type: 'number', step: '0.01' },
      { name: 'depth', label: 'Profundidade', type: 'number', step: '0.01' },
      { name: 'dimension_unit', label: 'Unidade', placeholder: 'cm' },
    ],
  },
  {
    title: 'Informações comerciais',
    description: 'Dados opcionais para organizar disponibilidade e edição.',
    fields: [
      { name: 'availability', label: 'Disponibilidade', type: 'availability' },
      { name: 'price', label: 'Preço', type: 'number', step: '0.01' },
      { name: 'currency', label: 'Moeda', placeholder: 'BRL' },
      { name: 'edition', label: 'Edição' },
      { name: 'print_run', label: 'Tiragem' },
      { name: 'signed', label: 'Assinada?', type: 'signed' },
    ],
  },
  {
    title: 'Contexto e organização',
    description: 'Detalhes de procedência, conservação e ordem no portfólio.',
    fields: [
      { name: 'creation_location', label: 'Local de criação' },
      { name: 'condition', label: 'Estado de conservação' },
      { name: 'position', label: 'Ordem no portfólio', type: 'number' },
      { name: 'exhibitions', label: 'Exposições e contexto', type: 'textarea', wide: true },
    ],
  },
]

function Field({ field, value, categories, onChange }) {
  const id = 'cms-field-' + field.name
  const common = {
    id,
    value: value ?? '',
    required: field.required,
    onChange: event => onChange(field.name, event.target.value),
  }
  let control

  if (field.type === 'textarea') {
    control = <textarea {...common} rows={4} />
  } else if (field.type === 'category') {
    control = (
      <select {...common}>
        <option value="">Selecione uma categoria</option>
        {categories.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
    )
  } else if (field.type === 'availability') {
    control = (
      <select {...common}>
        <option value="">Não informado</option>
        <option value="available">Disponível</option>
        <option value="sold">Vendido</option>
        <option value="reserved">Reservado</option>
        <option value="not_for_sale">Não está à venda</option>
      </select>
    )
  } else if (field.type === 'signed') {
    control = (
      <select {...common} value={value == null ? '' : String(value)}>
        <option value="">Não informado</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    )
  } else {
    control = <input {...common} type={field.type || 'text'} step={field.step} placeholder={field.placeholder || ''} />
  }

  return (
    <div className={'cms-editor-field' + (field.wide ? ' wide' : '')}>
      <label htmlFor={id}>{field.label}{field.required ? ' *' : ''}</label>
      {control}
    </div>
  )
}

export function CmsWorkEditor({ work, categories, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({ ...work, category: String(work.category ?? '') }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setForm({ ...work, category: String(work.category ?? '') })
    setSaved(false)
  }, [work])

  const changeField = (name, value) => {
    setForm(current => ({ ...current, [name]: value }))
    setSaved(false)
  }

  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    const payload = { ...form, category: Number(form.category) }
    payload.signed = form.signed === '' || form.signed == null ? null : form.signed === true || form.signed === 'true'
    try {
      await onSave(payload)
      setSaved(true)
    } catch (err) {
      setError(err.message || 'Não foi possível salvar as alterações.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="cms-editor">
      <button className="cms-editor-back" type="button" onClick={onCancel}>← Voltar para a biblioteca</button>
      <header className="cms-editor-heading">
        <div>
          <p className="cms-eyebrow">EDIÇÃO DE OBRA · #{work.id}</p>
          <h1>{work.title || 'Obra'}<span>.</span></h1>
          <p>Atualize os detalhes da obra. As alterações ficam salvas, mas não mudam o estado de publicação.</p>
        </div>
        <span className={'cms-work-status ' + (work.published ? 'published' : 'draft')}>{work.published ? 'Publicada' : 'Rascunho'}</span>
      </header>

      <form onSubmit={submit}>
        {SECTIONS.map(section => (
          <section className="cms-editor-section" key={section.title}>
            <div className="cms-editor-section-heading">
              <h2>{section.title}</h2>
              <p>{section.description}</p>
            </div>
            <div className="cms-editor-fields">
              {section.fields.map(field => (
                <Field key={field.name} field={field} value={form[field.name]} categories={categories} onChange={changeField} />
              ))}
            </div>
          </section>
        ))}
        {error && <div className="cms-editor-message error" role="alert">{error}</div>}
        {saved && <div className="cms-editor-message success" role="status">Alterações salvas. A publicação da obra não foi modificada.</div>}
        <div className="cms-editor-actions">
          <button className="cms-editor-cancel" type="button" onClick={onCancel}>Cancelar</button>
          <button className="cms-primary-button" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'} <span>↗</span></button>
        </div>
      </form>
    </section>
  )
}
