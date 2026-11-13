import { useEffect, useState } from 'react'
import { useCmsConfirm } from './useCmsConfirm.jsx'

const SECTIONS = [
  {
    title: 'Identificação',
    description: 'As informações principais que apresentam a obra.',
    fields: [
      { name: 'title', label: 'Nome da obra', required: true, placeholder: 'Ex.: Entrelaços', help: 'Use o título pelo qual você identifica ou apresenta esta obra.' },
      { name: 'category', label: 'Categoria', type: 'category', required: true, help: 'Escolha em qual seção do portfólio esta obra deve aparecer.' },
      { name: 'year', label: 'Ano de criação', type: 'number', placeholder: 'Ex.: 2024', help: 'Informe o ano em que a obra foi concluída ou iniciada.' },
      { name: 'description', label: 'Descrição', type: 'textarea', wide: true, placeholder: 'Conte um pouco sobre esta obra…', help: 'Texto de apresentação que ajuda o visitante a compreender a obra.' },
      { name: 'detail', label: 'Observações adicionais', type: 'textarea', wide: true, placeholder: 'Informações complementares, referências ou curiosidades…', help: 'Use para detalhes que não se encaixam nos demais campos.' },
    ],
  },
  {
    title: 'Técnica e materiais',
    description: 'Como a obra foi criada e a qual série pertence.',
    fields: [
      { name: 'technique', label: 'Técnica', placeholder: 'Ex.: aquarela, óleo sobre tela, fotografia digital', help: 'Descreva o processo ou a técnica artística utilizada.' },
      { name: 'material', label: 'Materiais', placeholder: 'Ex.: tinta acrílica, grafite, madeira', help: 'Liste os materiais utilizados na produção.' },
      { name: 'support', label: 'Suporte', placeholder: 'Ex.: tela, papel, madeira, tecido', help: 'Informe a superfície ou estrutura que recebe a obra.' },
      { name: 'series', label: 'Série ou coleção', placeholder: 'Ex.: Cartografias afetivas', help: 'Preencha se a obra fizer parte de um conjunto ou projeto.' },
    ],
  },
  {
    title: 'Dimensões',
    description: 'Preencha somente as medidas que fizerem sentido para a obra.',
    fields: [
      { name: 'height', label: 'Altura', type: 'number', step: '0.01', placeholder: 'Ex.: 40', help: 'Medida vertical. Use a unidade escolhida abaixo.' },
      { name: 'width', label: 'Largura', type: 'number', step: '0.01', placeholder: 'Ex.: 30', help: 'Medida horizontal. Use a unidade escolhida abaixo.' },
      { name: 'depth', label: 'Profundidade', type: 'number', step: '0.01', placeholder: 'Ex.: 5', help: 'Preencha quando a espessura ou profundidade for relevante.' },
      { name: 'dimension_unit', label: 'Unidade', placeholder: 'cm', help: 'Unidade usada nas medidas: cm, mm, m etc.' },
    ],
  },
  {
    title: 'Informações comerciais',
    description: 'Dados opcionais para organizar disponibilidade e edição.',
    fields: [
      { name: 'availability', label: 'Disponibilidade', type: 'availability', help: 'Indique se a obra pode ser adquirida, já foi vendida ou está reservada.' },
      { name: 'price', label: 'Preço', type: 'number', step: '0.01', placeholder: 'Ex.: 850,00', help: 'Valor numérico sem símbolo da moeda. Deixe vazio se não quiser informar.' },
      { name: 'currency', label: 'Moeda', placeholder: 'BRL', help: 'Código da moeda, como BRL para real ou USD para dólar.' },
      { name: 'edition', label: 'Edição', placeholder: 'Ex.: edição limitada ou peça única', help: 'Identifique se é peça única, edição aberta ou limitada.' },
      { name: 'print_run', label: 'Tiragem', placeholder: 'Ex.: 3/10', help: 'Número desta cópia e total da edição, quando aplicável.' },
      { name: 'signed', label: 'Assinada?', type: 'signed', help: 'Informe se a obra possui assinatura da artista.' },
    ],
  },
  {
    title: 'Contexto e organização',
    description: 'Detalhes de procedência, conservação e ordem no portfólio.',
    fields: [
      { name: 'creation_location', label: 'Local de criação', placeholder: 'Ex.: Porto Alegre, RS', help: 'Cidade, estado ou país onde a obra foi criada.' },
      { name: 'condition', label: 'Estado de conservação', placeholder: 'Ex.: excelente, bom estado, restaurada', help: 'Descreva a condição atual da obra, se essa informação for relevante.' },
      { name: 'position', label: 'Ordem dentro da categoria', type: 'number', required: true, help: 'Número menor aparece primeiro na categoria. Você também pode reorganizar na área Categorias.' },
      { name: 'exhibitions', label: 'Exposições e contexto', type: 'textarea', wide: true, placeholder: 'Ex.: exposta na Mostra X, em 2025…', help: 'Registre exposições, prêmios, publicações ou contexto de apresentação.' },
      { name: 'is_share_image', label: 'Usar como imagem de compartilhamento', type: 'checkbox', wide: true, help: 'Quando ativada, esta obra será a imagem padrão ao compartilhar o portfólio. Apenas uma obra pode ocupar esse papel.' },
      { name: 'image_url', label: 'URL alternativa da imagem (avançado)', type: 'url', wide: true, placeholder: 'https://…', help: 'Use somente se a imagem estiver hospedada fora do envio de arquivos. Normalmente, deixe em branco.' },
    ],
  },
]

function Field({ field, value, categories, onChange }) {
  const id = 'cms-field-' + field.name
  const common = {
    id,
    value: value ?? '',
    required: field.required,
    'aria-describedby': field.help ? id + '-help' : undefined,
    onChange: event => onChange(field.name, event.target.value),
  }
  let control

  if (field.type === 'textarea') {
    control = <textarea {...common} rows={4} placeholder={field.placeholder || ''} />
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
  } else if (field.type === 'checkbox') {
    control = <input {...common} type="checkbox" checked={Boolean(value)} onChange={event => onChange(field.name, event.target.checked)} />
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
      {field.help && <small className="cms-field-help" id={id + '-help'}>{field.help}</small>}
    </div>
  )
}

export function CmsWorkEditor({ work, categories, isNew = false, onCancel, onSave, onUploadCover, onLoadGallery, onUploadGalleryImage, onReplaceGalleryImage, onDeleteGalleryImage, onReorderGalleryImages, onLoadVideos, onAddVideo, onUpdateVideo, onDeleteVideo, onReorderVideos, onPreview, onPublish, onDelete, canDelete = false }) {
  const { confirm, dialogNode } = useCmsConfirm()
  const [form, setForm] = useState(() => ({ ...work, category: String(work.category ?? '') }))
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [dirty, setDirty] = useState(false)
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
  const [draggingGalleryId, setDraggingGalleryId] = useState(null)
  const [dragOverGalleryId, setDragOverGalleryId] = useState(null)
  const [videos, setVideos] = useState([])
  const [videosLoading, setVideosLoading] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [editingVideoId, setEditingVideoId] = useState(null)
  const [editingVideoUrl, setEditingVideoUrl] = useState('')
  const [videoAdding, setVideoAdding] = useState(false)
  const [videoBusyId, setVideoBusyId] = useState(null)
  const [videoError, setVideoError] = useState('')
  const [videoNotice, setVideoNotice] = useState('')
  const [draggingVideoId, setDraggingVideoId] = useState(null)
  const [dragOverVideoId, setDragOverVideoId] = useState(null)

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

  useEffect(() => {
    if (!work.id) return
    let active = true
    setVideosLoading(true)
    onLoadVideos(work.id)
      .then(items => { if (active) setVideos(items) })
      .catch(err => { if (active) setVideoError(err.message || 'Não foi possível carregar os vídeos.') })
      .finally(() => { if (active) setVideosLoading(false) })
    return () => { active = false }
  }, [work.id, onLoadVideos])

  const togglePublication = async () => {
    if (dirty) {
      setError('Salve as alterações da ficha antes de alterar a publicação.')
      return
    }
    const nextPublished = !work.published
    const message = nextPublished
      ? 'Publicar esta obra? Ela ficará visível para todas as pessoas no portfólio.'
      : 'Despublicar esta obra? Ela deixará de aparecer no portfólio público.'
    if (!(await confirm({ title: nextPublished ? 'Publicar obra?' : 'Despublicar obra?', message, target: form.title || work.title || 'Obra sem título', confirmLabel: nextPublished ? 'Publicar obra' : 'Despublicar', variant: 'default' }))) return
    setPublishing(true)
    setError('')
    setSaved(false)
    try {
      await onPublish(work.id, nextPublished)
    } catch (err) {
      setError(err.message || 'Não foi possível atualizar a publicação.')
    } finally {
      setPublishing(false)
    }
  }
  const deleteWork = async () => {
    if (!(await confirm({ title: 'Excluir obra?', message: 'A obra e todas as imagens e vídeos vinculados serão removidos permanentemente. Esta ação não pode ser desfeita.', confirmLabel: 'Excluir obra', variant: 'danger' }))) return
    setSaving(true)
    setError('')
    try {
      await onDelete(work.id)
    } catch (err) {
      setError(err.message || 'Não foi possível excluir a obra.')
      setSaving(false)
    }
  }

  const previewWork = async () => {
    const previewWindow = window.open('about:blank', '_blank')
    if (!previewWindow) {
      setError('Permita a abertura de novas janelas para visualizar a prévia.')
      return
    }
    previewWindow.opener = null
    setError('')
    try {
      const url = await onPreview(work.id)
      previewWindow.location = url
    } catch (err) {
      previewWindow.close()
      setError(err.message || 'Não foi possível gerar a prévia desta obra.')
    }
  }

  const addVideo = async event => {
    event.preventDefault()
    const url = videoUrl.trim()
    if (!url) return
    setVideoAdding(true)
    setVideoError('')
    setVideoNotice('')
    try {
      const item = await onAddVideo(work.id, url)
      setVideos(current => [...current, item])
      setVideoUrl('')
      setVideoNotice('Vídeo adicionado à obra.')
    } catch (err) {
      setVideoError(err.message || 'Não foi possível adicionar o vídeo.')
    } finally {
      setVideoAdding(false)
    }
  }

  const startEditVideo = item => {
    setEditingVideoId(item.id)
    setEditingVideoUrl(item.youtubeUrl || '')
    setVideoError('')
    setVideoNotice('')
  }

  const cancelEditVideo = () => {
    setEditingVideoId(null)
    setEditingVideoUrl('')
  }

  const editVideo = async item => {
    const nextUrl = editingVideoUrl.trim()
    if (!nextUrl || nextUrl === item.youtubeUrl) {
      cancelEditVideo()
      return
    }
    setVideoBusyId(item.id); setVideoError(''); setVideoNotice('')
    try {
      const updated = await onUpdateVideo(work.id, item.id, nextUrl)
      setVideos(current => current.map(video => video.id === item.id ? updated : video))
      setVideoNotice('Link e miniatura do vídeo atualizados.')
      cancelEditVideo()
    } catch (err) { setVideoError(err.message || 'Não foi possível atualizar o vídeo.') }
    finally { setVideoBusyId(null) }
  }

  const deleteVideo = async item => {
    if (!(await confirm({ title: 'Remover vídeo?', message: 'Este vídeo deixará de aparecer junto à obra. Esta ação não pode ser desfeita.', confirmLabel: 'Remover vídeo', variant: 'danger' }))) return
    setVideoBusyId(item.id)
    setVideoError('')
    setVideoNotice('')
    try {
      await onDeleteVideo(work.id, item.id)
      setVideos(current => current.filter(video => video.id !== item.id))
      setVideoNotice('Vídeo removido da obra.')
    } catch (err) {
      setVideoError(err.message || 'Não foi possível remover o vídeo.')
    } finally {
      setVideoBusyId(null)
    }
  }

  const reorderVideoItems = async (sourceIndex, targetIndex) => {
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= videos.length || targetIndex >= videos.length || sourceIndex === targetIndex) return
    const next = [...videos]
    const [dragged] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, dragged)
    setVideos(next)
    setVideoError('')
    setVideoNotice('')
    try {
      const savedItems = await onReorderVideos(work.id, next.map(item => item.id))
      setVideos(savedItems)
      setVideoNotice('Ordem dos vídeos atualizada.')
    } catch (err) {
      setVideoError(err.message || 'Não foi possível reorganizar os vídeos.')
      try { setVideos(await onLoadVideos(work.id)) } catch { /* preserve reorder error */ }
    }
  }

  const moveVideo = (index, direction) => reorderVideoItems(index, index + direction)

  const changeField = (name, value) => {
    setForm(current => ({ ...current, [name]: value }))
    setSaved(false)
    setError('')
    setDirty(true)
  }

  const cancelEditing = async () => {
    if (dirty && !(await confirm({ title: 'Descartar alterações?', message: 'As mudanças feitas nesta ficha ainda não foram salvas. Se sair agora, elas serão perdidas.', confirmLabel: 'Descartar alterações', variant: 'danger' }))) return
    onCancel()
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

  const replaceGalleryItem = async (item, event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      setGalleryError('A imagem deve ter no máximo 15 MB.')
      return
    }
    setGalleryBusyId(item.id); setGalleryError(''); setGalleryNotice('')
    try {
      const updated = await onReplaceGalleryImage(work.id, item.id, file)
      setGallery(current => current.map(image => image.id === item.id ? updated : image))
      setGalleryNotice('Imagem substituída.')
    } catch (err) { setGalleryError(err.message || 'Não foi possível substituir a imagem.') }
    finally { setGalleryBusyId(null) }
  }

  const deleteGalleryItem = async item => {
    if (!(await confirm({ title: 'Remover imagem?', message: 'Esta imagem será removida da galeria da obra. Esta ação não pode ser desfeita.', confirmLabel: 'Remover imagem', variant: 'danger' }))) return
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

  const reorderGalleryItems = async (sourceIndex, targetIndex) => {
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= gallery.length || targetIndex >= gallery.length || sourceIndex === targetIndex) return
    const next = [...gallery]
    const [dragged] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, dragged)
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

  const moveGalleryItem = (index, direction) => reorderGalleryItems(index, index + direction)

  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    const payload = Object.fromEntries(SECTIONS.flatMap(section => section.fields).map(field => [field.name, form[field.name]]))
    payload.category = Number(form.category)
    payload.signed = form.signed === '' || form.signed == null ? null : form.signed === true || form.signed === 'true'
    const addAnother = event.nativeEvent.submitter?.value === 'add-another'
    try {
      await onSave(payload, { addAnother })
      if (isNew && addAnother) {
        setForm(current => ({ ...current, id: null, title: '', description: '', detail: '', technique: '', material: '', support: '', year: '', height: '', width: '', depth: '', price: '', availability: '', series: '', edition: '', print_run: '', signed: null, creation_location: '', condition: '', exhibitions: '', is_share_image: false, image_url: '', position: Number(payload.position || 0) + 1, published: false }))
        setCreated(false)
        setSaved(false)
        setDirty(false)
        setCoverError('')
        setCoverSaved(false)
        setGallery([])
        setVideos([])
        setVideoUrl('')
        setVideoError('')
        setGalleryError('')
      } else {
        if (isNew) setCreated(true)
        setDirty(false)
        setSaved(true)
      }
    } catch (err) {
      setError(err.message || 'Não foi possível salvar as alterações.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="cms-editor">
      <button className="cms-editor-back" type="button" onClick={cancelEditing} disabled={saving}>← Voltar para a biblioteca</button>
      <header className="cms-editor-heading">
        <div>
          <p className="cms-eyebrow">{isNew ? 'NOVA OBRA' : 'EDIÇÃO DE OBRA · #' + work.id}</p>
          <h1>{work.title || (isNew ? 'Nova obra' : 'Obra')}<span>.</span></h1>
          <p>Edite os dados da obra. Salvar não altera sua publicação; a prévia mostra a última versão salva.</p>
        </div>
        <div className="cms-editor-heading-actions">
          {!isNew && work.id && <button className="cms-editor-cancel" type="button" onClick={deleteWork} disabled={saving || !canDelete} title={!canDelete ? 'Sua conta não tem permissão para excluir obras. Solicite a permissão Excluir obra no Django Admin.' : 'Excluir definitivamente esta obra e seus arquivos vinculados.'}>Excluir obra</button>}
          {!isNew && work.id && <button className="cms-cover-upload" type="button" onClick={previewWork} disabled={dirty} title={dirty ? 'Salve as alterações antes de abrir a prévia.' : 'Abrir uma prévia privada desta obra.'}>{dirty ? 'Salve para prévia' : 'Visualizar prévia ↗'}</button>}
          {!isNew && work.id && <button className="cms-cover-upload" type="button" onClick={togglePublication} disabled={publishing || dirty}>{publishing ? 'Atualizando…' : work.published ? 'Despublicar obra' : 'Publicar obra'}</button>}
          <div className={'cms-publication-state ' + (work.published ? 'published' : 'draft')} role="status" aria-live="polite"><span className="cms-publication-state-dot" /><span><strong>{work.published ? 'No ar' : 'Rascunho'}</strong><small>{work.published ? 'Esta obra está visível para visitantes no portfólio público.' : 'Esta obra não aparece no portfólio público até ser publicada.'}</small></span></div>
        </div>
      </header>
      {dirty && <div className="cms-save-state pending" role="status" aria-live="polite"><span className="cms-save-state-dot" />Alterações não salvas. Salve a ficha para atualizar a prévia e manter tudo no portfólio.</div>}

      <details className="cms-editor-section cms-cover-section cms-editor-collapsible">
        <summary className="cms-editor-section-heading"><span><h2>Imagem de capa</h2><p>Esta é a imagem principal que representa a obra na grade do portfólio.</p></span><span className="cms-editor-collapse-indicator" aria-hidden="true">⌄</span></summary>
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
      </details>

      <details className="cms-editor-section cms-gallery-section cms-editor-collapsible">
        <summary className="cms-editor-section-heading"><span><h2>Galeria de imagens</h2><p>Adicione detalhes, ângulos e registros do processo. A capa permanece separada.</p></span><span className="cms-editor-collapse-indicator" aria-hidden="true">⌄</span></summary>
        {work.id && <label className={'cms-cover-upload cms-gallery-add-control' + (galleryUploading ? ' disabled' : '')}>{galleryUploading ? 'Enviando…' : '＋ Adicionar imagens'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadGallery} disabled={galleryUploading} /></label>}
        {!work.id ? <div className="cms-gallery-empty">Salve a obra primeiro para começar a montar a galeria.</div> : galleryLoading ? <div className="cms-gallery-empty">Carregando imagens…</div> : gallery.length ? (
          <div className="cms-gallery-grid">
            {gallery.map((item, index) => <article
              className={'cms-gallery-item cms-sortable-item' + (draggingGalleryId === item.id ? ' is-dragging' : '') + (dragOverGalleryId === item.id ? ' is-drop-target' : '')}
              key={item.id}
              draggable={!galleryUploading && galleryBusyId === null}
              onDragStart={event => { if (galleryUploading || galleryBusyId !== null) { event.preventDefault(); return } setDraggingGalleryId(item.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(item.id)) }}
              onDragOver={event => { if (draggingGalleryId === null || galleryUploading || galleryBusyId !== null) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOverGalleryId(item.id) }}
              onDrop={event => { event.preventDefault(); const source = gallery.findIndex(image => image.id === draggingGalleryId); const target = gallery.findIndex(image => image.id === item.id); reorderGalleryItems(source, target); setDraggingGalleryId(null); setDragOverGalleryId(null) }}
              onDragEnd={() => { setDraggingGalleryId(null); setDragOverGalleryId(null) }}
            >
              <div className="cms-gallery-thumb">{item.url ? <img src={item.url} alt={'Imagem adicional ' + (index + 1) + ' de ' + (work.title || 'obra')} loading="lazy" /> : <span>Imagem indisponível</span>}<small>{String(index + 1).padStart(2, '0')}</small></div>
              <div className="cms-gallery-item-actions">
                <button type="button" aria-label="Mover imagem para a esquerda" title="Mover para a esquerda" disabled={index === 0 || galleryBusyId === item.id} onClick={() => moveGalleryItem(index, -1)}>←</button>
                <button type="button" aria-label="Mover imagem para a direita" title="Mover para a direita" disabled={index === gallery.length - 1 || galleryBusyId === item.id} onClick={() => moveGalleryItem(index, 1)}>→</button>
                <label className="cms-gallery-replace">Substituir<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => replaceGalleryItem(item, event)} disabled={galleryBusyId === item.id} /></label>
                <button type="button" className="delete" disabled={galleryBusyId === item.id} onClick={() => deleteGalleryItem(item)}>{galleryBusyId === item.id ? '…' : 'Remover'}</button>
              </div>
            </article>)}
          </div>
        ) : <div className="cms-gallery-empty"><span>✳</span><strong>Nenhuma imagem adicional ainda</strong><small>Use “Adicionar imagens” para incluir fotos da obra.</small></div>}
        {galleryUploading && <div className="cms-gallery-progress" role="status">Enviando imagens para o acervo…</div>}
        {galleryError && <div className="cms-editor-message error" role="alert">{galleryError}</div>}
        {galleryNotice && <div className="cms-editor-message success" role="status">{galleryNotice}</div>}
      </details>
      <details className="cms-editor-section cms-videos-section cms-editor-collapsible">
        <summary className="cms-editor-section-heading"><span><h2>Vídeos do YouTube</h2><p>Vincule vídeos publicados no YouTube à obra. O painel salva o link e busca automaticamente título e miniatura.</p></span><span className="cms-editor-collapse-indicator" aria-hidden="true">⌄</span></summary>
        {!work.id ? <div className="cms-gallery-empty">Salve a obra primeiro para adicionar vídeos.</div> : (
          <>
            <form className="cms-video-add-form" onSubmit={addVideo}>
              <label htmlFor="cms-youtube-url">Link do vídeo</label>
              <div className="cms-video-add-row">
                <input id="cms-youtube-url" type="url" value={videoUrl} onChange={event => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" required />
                <button className="cms-cover-upload" type="submit" disabled={videoAdding || !videoUrl.trim()}>{videoAdding ? 'Validando…' : '＋ Adicionar vídeo'}</button>
              </div>
              <small>Use um link público e incorporável do YouTube.</small>
            </form>
            {videosLoading ? <div className="cms-gallery-empty">Carregando vídeos…</div> : videos.length ? (
              <div className="cms-video-list">
                {videos.map((item, index) => <article
                  className={'cms-video-item cms-sortable-item' + (draggingVideoId === item.id ? ' is-dragging' : '') + (dragOverVideoId === item.id ? ' is-drop-target' : '')}
                  key={item.id}
                  draggable={videoBusyId === null && !videoAdding}
                  onDragStart={event => { if (videoBusyId !== null || videoAdding) { event.preventDefault(); return } setDraggingVideoId(item.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(item.id)) }}
                  onDragOver={event => { if (draggingVideoId === null || videoBusyId !== null || videoAdding) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOverVideoId(item.id) }}
                  onDrop={event => { event.preventDefault(); const source = videos.findIndex(video => video.id === draggingVideoId); const target = videos.findIndex(video => video.id === item.id); reorderVideoItems(source, target); setDraggingVideoId(null); setDragOverVideoId(null) }}
                  onDragEnd={() => { setDraggingVideoId(null); setDragOverVideoId(null) }}
                >
                  <div className="cms-video-thumb">{item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" /> : <span>▶</span>}</div>
                  <div className="cms-video-info">
                    <strong>{item.title || 'Vídeo do YouTube'}</strong>
                    <a href={item.youtubeUrl} target="_blank" rel="noreferrer">Abrir no YouTube ↗</a>
                    {editingVideoId === item.id ? (
                      <div className="cms-video-inline-edit">
                        <label>Link do YouTube<input type="url" value={editingVideoUrl} onChange={event => setEditingVideoUrl(event.target.value)} required aria-label="Novo link do YouTube" /></label>
                        <div><button type="button" onClick={() => editVideo(item)} disabled={videoBusyId === item.id || !editingVideoUrl.trim()}>{videoBusyId === item.id ? 'Salvando…' : 'Salvar link'}</button><button type="button" onClick={cancelEditVideo} disabled={videoBusyId === item.id}>Cancelar</button></div>
                      </div>
                    ) : <small>Vídeo {String(index + 1).padStart(2, '0')}</small>}
                  </div>
                  <div className="cms-video-actions">
                    <button type="button" aria-label="Mover vídeo para cima" title="Mover para cima" disabled={index === 0 || videoBusyId === item.id} onClick={() => moveVideo(index, -1)}>↑</button>
                    <button type="button" aria-label="Mover vídeo para baixo" title="Mover para baixo" disabled={index === videos.length - 1 || videoBusyId === item.id} onClick={() => moveVideo(index, 1)}>↓</button>
                    {editingVideoId !== item.id && <button type="button" disabled={videoBusyId === item.id || editingVideoId !== null} onClick={() => startEditVideo(item)}>Editar link</button>}
                    <button type="button" className="delete" disabled={videoBusyId === item.id} onClick={() => deleteVideo(item)}>{videoBusyId === item.id ? '…' : 'Remover'}</button>
                  </div>
                </article>)}
              </div>
            ) : <div className="cms-gallery-empty"><span>▶</span><strong>Nenhum vídeo vinculado</strong><small>Adicione um link do YouTube para apresentar vídeos junto desta obra.</small></div>}
          </>
        )}
        {videoError && <div className="cms-editor-message error" role="alert">{videoError}</div>}
        {videoNotice && <div className="cms-editor-message success" role="status">{videoNotice}</div>}
      </details>
      <form onSubmit={submit}>
        {SECTIONS.map(section => (
          <details className="cms-editor-section cms-editor-collapsible" key={section.title} open={section.title === 'Identificação'}>
              <summary className="cms-editor-section-heading">
                <div><h2>{section.title}</h2><p>{section.description}</p></div>
                <span className="cms-editor-collapse-indicator" aria-hidden="true">⌄</span>
              </summary>
            <div className="cms-editor-fields">
              {section.fields.map(field => (
                <Field key={field.name} field={field} value={form[field.name]} categories={categories} onChange={changeField} />
              ))}
            </div>
        </details>
        ))}
        {error && <div className="cms-editor-message error" role="alert">{error}</div>}
        {saved && <div className="cms-editor-message success" role="status">{created ? 'Rascunho criado. A obra ainda não está publicada.' : work.published ? 'Alterações salvas. A obra continua publicada no portfólio.' : 'Alterações salvas. A obra continua como rascunho e não aparece no portfólio público.'}</div>}
        <div className="cms-editor-actions">
          <button className="cms-editor-cancel" type="button" onClick={cancelEditing} disabled={saving}>← Voltar para obras</button>
          <div className="cms-editor-save-actions">
            {isNew && <button className="cms-editor-cancel" type="submit" value="add-another" disabled={saving || !dirty}>{saving ? 'Salvando…' : 'Salvar e adicionar outra'}</button>}
            <button className="cms-primary-button" type="submit" value="save" disabled={saving || !dirty}>{saving ? 'Salvando…' : isNew ? 'Salvar obra' : 'Salvar e continuar editando'} <span>↗</span></button>
          </div>
        </div>
      </form>
      {dialogNode}
    </section>
  )
}
