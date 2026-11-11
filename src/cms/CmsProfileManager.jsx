import { useEffect, useState } from 'react'

function readCookie(name) {
  const prefix = name + '='
  const item = document.cookie.split('; ').find(cookie => cookie.startsWith(prefix))
  return item ? decodeURIComponent(item.slice(prefix.length)) : ''
}

const FIELDS = [
  { name: 'name', label: 'Nome', required: true },
  { name: 'tagline', label: 'Frase de apresentação' },
  { name: 'instagram_url', label: 'Instagram', type: 'url' },
  { name: 'contact_email', label: 'E-mail de contato', type: 'email' },
  { name: 'contact_form_url', label: 'Link do formulário externo', type: 'url' },
  { name: 'photo_url', label: 'URL alternativa da foto', type: 'url', wide: true },
  { name: 'bio', label: 'Biografia', type: 'textarea', wide: true, required: true },
]

export function CmsProfileManager() {
  const [profile, setProfile] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/cms/profile/', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }).then(async response => {
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(response.status === 403 ? 'Sua conta não tem permissão para acessar o perfil.' : 'Não foi possível carregar o perfil.')
      return data
    }).then(data => {
      if (!active) return
      setProfile(data.profile || {
        name: '', tagline: '', photo_url: '', bio: '',
        instagram_url: '', contact_email: '', contact_form_url: '',
      })
      setPermissions(data.permissions || {})
    }).catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const change = (name, value) => {
    setProfile(current => ({ ...current, [name]: value }))
    setNotice('')
  }


  const uploadPhoto = async () => {
    if (!photoFile) return
    setUploadingPhoto(true)
    setError('')
    setNotice('')
    try {
      const body = new FormData()
      body.append('image', photoFile)
      const response = await fetch('/api/cms/profile/photo/', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json', 'X-CSRFToken': readCookie('csrftoken') },
        body,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const messages = {
          invalid_image_file: 'O arquivo não parece ser uma imagem válida.',
          unsupported_image_format: 'Use uma imagem JPG, PNG ou WebP.',
          image_too_large: 'A imagem deve ter no máximo 15 MB.',
          invalid_image_dimensions: 'A imagem tem dimensões muito grandes.',
          image_storage_failed: 'Não foi possível armazenar a foto. A anterior foi preservada.',
        }
        throw new Error(messages[data.error] || 'Não foi possível enviar a foto.')
      }
      setProfile(current => ({ ...current, photo: data.photo }))
      setPhotoFile(null)
      setNotice('Foto do perfil atualizada.')
    } catch (err) {
      setError(err.message || 'Não foi possível enviar a foto.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const save = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/cms/profile/', {
        method: 'PATCH',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRFToken': readCookie('csrftoken'),
        },
        body: JSON.stringify(Object.fromEntries(FIELDS.map(field => [field.name, profile[field.name] ?? '']))),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const messages = Object.values(data.fields || {}).flat().map(item => item.message).filter(Boolean)
        throw new Error(messages.join(' · ') || (data.error === 'profile_edit_permission_required' ? 'Sua conta não tem permissão para editar o perfil.' : 'Não foi possível salvar o perfil.'))
      }
      setProfile(data.profile)
      setNotice('Perfil atualizado. As informações foram salvas.')
    } catch (err) {
      setError(err.message || 'Não foi possível salvar o perfil.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="cms-loading">Carregando perfil…</div>
  if (error && !profile) return <div className="cms-error" role="alert">{error}</div>
  if (!profile) return null

  const canSave = profile.id ? permissions.canChange : permissions.canAdd
  const photo = profile.photo || profile.photo_url

  return (
    <section className="cms-profile-page">
      <header className="cms-library-heading">
        <div><p className="cms-eyebrow">IDENTIDADE DO PORTFÓLIO</p><h1>Perfil<span>.</span></h1><p>Apresentação, biografia e canais de contato exibidos no site.</p></div>
      </header>
      <form className="cms-profile-form" onSubmit={save}>
        <div className="cms-profile-preview">
          {photo ? <img src={photo} alt="Prévia da foto do perfil" /> : <div className="cms-no-image"><span>LB</span><small>SEM FOTO</small></div>}
          <div className="cms-profile-photo-controls"><strong>Foto do perfil</strong><p>Envie uma imagem JPG, PNG ou WebP de até 15 MB. A foto anterior só é substituída quando o novo arquivo é validado e salvo.</p><div><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Escolher foto do perfil" onChange={event => setPhotoFile(event.target.files?.[0] || null)} /><button className="cms-cover-upload" type="button" disabled={!photoFile || uploadingPhoto || !permissions.canChange} onClick={uploadPhoto}>{uploadingPhoto ? 'Enviando…' : 'Atualizar foto'}</button></div></div>
        </div>
        <div className="cms-editor-fields">
          {FIELDS.map(field => (
            <label className={'cms-editor-field' + (field.wide ? ' wide' : '')} key={field.name}>
              <span>{field.label}{field.required ? ' *' : ''}</span>
              {field.type === 'textarea'
                ? <textarea rows={7} required={field.required} value={profile[field.name] ?? ''} onChange={event => change(field.name, event.target.value)} />
                : <input type={field.type || 'text'} required={field.required} value={profile[field.name] ?? ''} onChange={event => change(field.name, event.target.value)} />}
            </label>
          ))}
        </div>
        {error && <div className="cms-editor-message error" role="alert">{error}</div>}
        {notice && <div className="cms-editor-message success" role="status">{notice}</div>}
        <div className="cms-editor-actions">
          <span>{canSave ? 'As alterações serão refletidas no portfólio.' : 'Você tem acesso de leitura a este perfil.'}</span>
          <button className="cms-primary-button" type="submit" disabled={!canSave || saving}>{saving ? 'Salvando…' : 'Salvar perfil'} <span>↗</span></button>
        </div>
      </form>
    </section>
  )
}
