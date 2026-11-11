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
      { name: 'position', label: 'Ordem no portfólio', type: 'number', required: true },
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

export function CmsWorkEditor({ work, categories, isNew = false, onCancel, onSave, onUploadCover, onLoadGallery, onUploadGalleryImage, onDeleteGalleryImage, onReorderGalleryImages }) {
  const [form, setForm] = useState(() => ({ ...work, category: String(work.category ?? '') }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [created, setCreated] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverError, setCoverError] = useState('')
  const [coverSaved, setCoverSaved] = useState(false)
  const [gallery, setGallery] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [galleryUploading, setGalleryUploading] = useState(false)
  const [galleryError, setGalleryError] = useState('')
  const [galleryNotice, setGalleryNotice] = useState('')
  const [galleryBusyId, setGalleryBusyId] = useState(null)

  useEffect(() => {
    if (!work.id) return
    let active = true
    setGalleryLoading(true)
    onLoadGallery(work.id)
      .then(items => { if (active) setGallery(items) })
      .catch(err => { if (active) setGalleryError(err.message || 'Não foi possível carregar a galeria.') })
      .finally(() => { if (active) setGalleryLoading(false) })
    return () => { active = false }
  }, [work.id, onLoadGallery])

  const changeField = (name, value) => {
    setForm(current => ({ ...current, [name]: value }))
    setSaved(false)
  }

  const uploadCover = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      setCoverError('A imagem deve ter no máximo 15 MB.')
      return
    }
    if (!work.id) {
      setCoverError('Salve os dados da obra antes de enviar a capa.')
      return
    }
    setUploadingCover(true)
    setCoverError('')
    setCoverSaved(false)
    try {
      await onUploadCover(file)
      setCoverSaved(true)
    } catch (err) {
      setCoverError(err.message || 'Não foi possível enviar a imagem.')
    } finally {
      setUploadingCover(false)
    }
  }

  const uploadGallery = async event => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    const tooLarge = files.find(file => file.size > 15 * 1024 * 1024)
    if (tooLarge) {
      setGalleryError('Cada imagem deve ter no máximo 15 MB.')
      return
    }
    setGalleryUploading(true)
    setGalleryError('')
    setGalleryNotice('')
    try {
      for (const file of files) {
        const item = await onUploadGalleryImage(work.id, file)
        setGallery(current => [...current, item])
      }
      setGalleryNotice(files.length === 1 ? 'Imagem adicionada à galeria.' : files.length + ' imagens adicionadas à galeria.')
    } catch (err) {
      setGalleryError(err.message || 'Não foi possível enviar as imagens.')
      try { setGallery(await onLoadGallery(work.id)) } catch { /* preserve the upload error */ }
    } finally {
      setGalleryUploading(false)
    }
  }

  const deleteGalleryItem = async item => {
    if (!window.confirm('Remover esta imagem da galeria? Esta ação não pode ser desfeita.')) return
    setGalleryBusyId(item.id)
    setGalleryError('')
    setGalleryNotice('')
    try {
      await onDeleteGalleryImage(work.id, item.id)
      setGallery(current => current.filter(image => image.id !== item.id))
      setGalleryNotice('Imagem removida da galeria.')
    } catch (err) {
      setGalleryError(err.message || 'Não foi possível remover a imagem.')
    } finally {
      setGalleryBusyId(null)
    }
  }

  const moveGalleryItem = async (index, direction) => {
    const next = [...gallery]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setGallery(next)
    setGalleryError('')
    setGalleryNotice('')
    try {
      const savedItems = await onReorderGalleryImages(work.id, next.map(item => item.id))
      setGallery(savedItems)
      setGalleryNotice('Ordem da galeria atualizada.')
    } catch (err) {
      setGalleryError(err.message || 'Não foi possível reorganizar a galeria.')
      try { setGallery(await onLoadGallery(work.id)) } catch { /* preserve the reorder error */ }
    }
  }

  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    const payload = Object.fromEntries(SECTIONS.flatMap(section => section.fields).map(field => [field.name, form[field.name]]))
    payload.category = Number(form.category)
    payload.signed = form.signed === '' || form.signed == null ? null : form.signed === true || form.signed === 'true'
    try {
      await onSave(payload)
      if (isNew) setCreated(true)
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
          <p className="cms-eyebrow">{isNew ? 'NOVA OBRA' : 'EDIÇÃO DE OBRA · #' + work.id}</p>
          <h1>{work.title || (isNew ? 'Nova obra' : 'Obra')}<span>.</span></h1>
          <p>Atualize os detalhes da obra. As alterações ficam salvas, mas não mudam o estado de publicação.</p>
        </div>
        <span className={'cms-work-status ' + (work.published ? 'published' : 'draft')}>{work.published ? 'Publicada' : 'Rascunho'}</span>
      </header>

      <section className="cms-editor-section cms-cover-section">
        <div className="cms-editor-section-heading">
          <h2>Imagem de capa</h2>
          <p>Esta é a imagem principal que representa a obra na grade do portfólio.</p>
        </div>
        <div className="cms-cover-layout">
          <div className="cms-cover-preview">
            {work.image ? <img src={work.image} alt={'Capa de ' + (work.title || 'obra')} /> : <div className="cms-cover-placeholder"><span>✳</span><small>SEM CAPA</small></div>}
          </div>
          <div className="cms-cover-controls">
            <strong>{work.image ? 'Capa atual' : 'Ainda não há uma capa'}</strong>
            <p>JPG, PNG ou WebP · até 15 MB. A imagem anterior só é substituída quando o novo arquivo é validado e salvo.</p>
            <label className={'cms-cover-upload' + (uploadingCover || !work.id ? ' disabled' : '')}>
              {uploadingCover ? 'Enviando imagem…' : work.image ? 'Substituir capa' : 'Escolher imagem'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadCover} disabled={uploadingCover || !work.id} />
            </label>
            {!work.id && <small>Salve a obra primeiro para liberar o envio da capa.</small>}
            {coverError && <div className="cms-editor-message error" role="alert">{coverError}</div>}
            {coverSaved && <div className="cms-editor-message success" role="status">Capa atualizada com sucesso.</div>}
          </div>
        </div>
      </section>

      <section className="cms-editor-section cms-gallery-section">
        <div className="cms-editor-section-heading cms-gallery-heading">
          <div><h2>Galeria de imagens</h2><p>Adicione detalhes, ângulos e registros do processo. A capa permanece separada.</p></div>
          {work.id && <label className={'cms-cover-upload' + (galleryUploading ? ' disabled' : '')}>{galleryUploading ? 'Enviando…' : '＋ Adicionar imagens'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadGallery} disabled={galleryUploading} /></label>}
        </div>
        {!work.id ? <div className="cms-gallery-empty">Salve a obra primeiro para começar a montar a galeria.</div> : galleryLoading ? <div className="cms-gallery-empty">Carregando imagens…</div> : gallery.length ? (
          <div className="cms-gallery-grid">
            {gallery.map((item, index) => <article className="cms-gallery-item" key={item.id}>
              <div className="cms-gallery-thumb">{item.url ? <img src={item.url} alt={'Imagem adicional ' + (index + 1) + ' de ' + (work.title || 'obra')} loading="lazy" /> : <span>Imagem indisponível</span>}<small>{String(index + 1).padStart(2, '0')}</small></div>
              <div className="cms-gallery-item-actions">
                <button type="button" aria-label="Mover imagem para a esquerda" title="Mover para a esquerda" disabled={index === 0 || galleryBusyId === item.id} onClick={() => moveGalleryItem(index, -1)}>←</button>
                <button type="button" aria-label="Mover imagem para a direita" title="Mover para a direita" disabled={index === gallery.length - 1 || galleryBusyId === item.id} onClick={() => moveGalleryItem(index, 1)}>→</button>
                <button type="button" className="delete" disabled={galleryBusyId === item.id} onClick={() => deleteGalleryItem(item)}>{galleryBusyId === item.id ? '…' : 'Remover'}</button>
              </div>
            </article>)}
          </div>
        ) : <div className="cms-gallery-empty"><span>✳</span><strong>Nenhuma imagem adicional ainda</strong><small>Use “Adicionar imagens” para incluir fotos da obra.</small></div>}
        {galleryUploading && <div className="cms-gallery-progress" role="status">Enviando imagens para o acervo…</div>}
        {galleryError && <div className="cms-editor-message error" role="alert">{galleryError}</div>}
        {galleryNotice && <div className="cms-editor-message success" role="status">{galleryNotice}</div>}
      </section>
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
        {saved && <div className="cms-editor-message success" role="status">{created ? 'Rascunho criado. A obra ainda não está publicada.' : 'Alterações salvas. A publicação da obra não foi modificada.'}</div>}
        <div className="cms-editor-actions">
          <button className="cms-editor-cancel" type="button" onClick={onCancel}>Cancelar</button>
          <button className="cms-primary-button" type="submit" disabled={saving}>{saving ? 'Salvando…' : isNew ? 'Criar rascunho' : 'Salvar alterações'} <span>↗</span></button>
        </div>
      </form>
    </section>
  )
}
