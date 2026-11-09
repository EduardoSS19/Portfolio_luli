(() => {
  const fields = {
    accent: '--site-accent',
    background: '--site-background',
    background_alt: '--site-background-alt',
    surface: '--site-surface',
    text: '--site-text',
    border: '--site-border',
  }
  const defaults = {
    accent: '#93C8F2',
    background: '#061522',
    background_alt: '#102F4C',
    surface: '#0B2943',
    text: '#EFF7FF',
    border: '#93C8F2',
  }
  function applyPreview() {
    Object.entries(fields).forEach(([name, variable]) => {
      const input = document.getElementById('id_' + name)
      if (input?.value) document.documentElement.style.setProperty(variable, input.value)
    })
  }
  document.addEventListener('DOMContentLoaded', () => {
    Object.keys(fields).forEach(name => {
      document.getElementById('id_' + name)?.addEventListener('input', applyPreview)
    })
    const form = document.querySelector('#siteappearance_form')
    if (!form) return
    const actions = document.createElement('div')
    actions.className = 'appearance-preview-actions'
    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'button'
    reset.textContent = 'Restaurar cores originais'
    reset.addEventListener('click', () => {
      Object.entries(defaults).forEach(([name, value]) => {
        const input = document.getElementById('id_' + name)
        if (input) input.value = value
      })
      applyPreview()
    })
    actions.append(reset)
    form.querySelector('.submit-row')?.before(actions)
    applyPreview()
  })
})()
