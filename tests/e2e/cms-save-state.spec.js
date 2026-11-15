import { test, expect } from '@playwright/test'

async function mockDashboard(page) {
  await page.route('**/api/cms/overview/', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      works: { total: 0, published: 0, drafts: 0 },
      categories: 0, categoryOptions: [], references: 0, videos: 0,
      permissions: { canCreateWork: false, canEditWork: false, canDeleteWork: false },
    }),
  }))
  await page.route('**/api/cms/works/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ results: [], pagination: { total: 0, hasMore: false } }),
  }))
  await page.route('**/api/cms/analytics/', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'not_configured', historical: null, realtime: null }),
  }))
}

test('perfil sinaliza alterações pendentes e permite descartá-las ou salvá-las', async ({ page }) => {
  let profile = {
    id: 1, name: 'Luli Becker', tagline: 'Arte e experimentação', photo_url: '',
    bio: 'Artista visual.', instagram_url: 'https://instagram.com/luli',
    contact_email: 'contato@example.com', contact_form_url: '',
  }
  let patchCount = 0
  await mockDashboard(page)
  await page.route('**/api/cms/profile/', async route => {
    if (route.request().method() === 'PATCH') {
      patchCount += 1
      profile = { ...profile, ...route.request().postDataJSON() }
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ profile, permissions: { canChange: true, canAdd: false } }),
    })
  })

  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await page.locator('.cms-nav').getByRole('button', { name: /Perfil/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Perfil')
  await expect(page.locator('.cms-save-state')).toContainText('Tudo salvo')
  const name = page.getByLabel('Nome')
  await name.fill('Nome temporário')
  await expect(page.locator('.cms-save-state')).toContainText('alterações não salvas')
  await page.getByRole('button', { name: 'Descartar alterações' }).click()
  await expect(name).toHaveValue('Luli Becker')
  await expect(page.locator('.cms-save-state')).toContainText('Tudo salvo')

  await name.fill('Luli Becker Atualizada')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.locator('.cms-editor-message[role="status"]')).toContainText('Perfil atualizado')
  await expect(page.locator('.cms-save-state')).toContainText('Tudo salvo')
  expect(patchCount).toBe(1)
})

test('conteúdo complementar só habilita salvar quando há mudanças', async ({ page }) => {
  let socialLinks = []
  await mockDashboard(page)
  await page.route('**/api/cms/content/**', async route => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON()
      socialLinks = [{ id: 9, title: payload.title, url: payload.url, position: 0, active: payload.is_active }]
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ results: socialLinks, permissions: { canView: true, canAdd: true, canChange: true, canDelete: true } }),
    })
  })

  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await page.locator('.cms-nav').getByRole('button', { name: /Conteúdo/ }).click()
  const saveButton = page.getByRole('button', { name: 'Adicionar item' })
  await expect(saveButton).toBeDisabled()
  await expect(page.locator('.cms-save-state.compact')).toContainText('Preencha os campos')
  await page.getByLabel('Nome da rede social').fill('Behance')
  await page.getByLabel('URL').fill('https://behance.net/artista')
  await expect(page.locator('.cms-save-state.compact')).toContainText('Alterações ainda não salvas')
  await expect(saveButton).toBeEnabled()
  await saveButton.click()
  await expect(page.locator('.cms-editor-message[role="status"]')).toContainText('Item adicionado')
  await expect(page.getByLabel('Nome da rede social')).toHaveValue('')
})


test('painel oferece retorno ao topo depois de rolar uma seção longa', async ({ page }) => {
  await mockDashboard(page)
  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => { document.body.style.minHeight = '1800px'; window.scrollTo(0, 900) })
  const backToTop = page.getByRole('button', { name: 'Voltar ao topo do painel' })
  await expect(backToTop).toBeVisible()
  await backToTop.click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(40)
})

test('opções de layout exibem uma prévia temporária antes de serem selecionadas', async ({ page }) => {
  await mockDashboard(page)
  await page.route('**/api/cms/layout/', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      settings: {
        content_width: 'standard', hero_alignment: 'center', hero_size: 'large',
        section_spacing: 'comfortable', gallery_columns: '3', default_gallery_view: 'lista',
        default_theme: 'escuro', dark_color_background: '#061522', dark_color_surface: '#0b2943',
        dark_color_text: '#eff7ff', dark_color_muted: '#a9bdcc', dark_color_accent: '#93c8f2',
        light_color_background: '#f5f2eb', light_color_surface: '#ffffff', light_color_text: '#24231f',
        light_color_muted: '#77746c', light_color_accent: '#657c62',
        show_bio_image: true, show_bio: true, show_references: true,
      },
      permissions: { canChange: true },
    }),
  }))
  await page.route('**/api/portfolio/', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ categorias: [], referencias: [], frames: [], redes: [], sobre: null, marca: '', layout: {} }),
  }))

  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await page.locator('.cms-nav').getByRole('button', { name: /Layout/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Layout')

  const compositionGroup = page.locator('.cms-layout-field-group').first()
  await compositionGroup.locator('summary').click()
  const leftOption = compositionGroup.locator('.cms-layout-option').filter({ hasText: 'À esquerda' })
  await leftOption.scrollIntoViewIfNeeded()
  const panelScrollBeforeHover = await page.evaluate(() => window.scrollY)
  const optionBeforeHover = await leftOption.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  await leftOption.hover()
  const hoverPreview = page.locator('.cms-layout-hover-preview')
  await expect(hoverPreview).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(panelScrollBeforeHover)
  await expect(hoverPreview.getByText('À esquerda', { exact: true })).toBeVisible()
  const temporaryFrame = hoverPreview.locator('iframe')
  await expect(temporaryFrame).toHaveAttribute('src', '/?layout_preview=1&layout_preview_compact=1')
  await expect(temporaryFrame).not.toHaveAttribute('src', /layout_preview_live/)
  await expect(leftOption.locator('input')).not.toBeChecked()
  await expect.poll(() => temporaryFrame.evaluate(frame => frame.getBoundingClientRect().width)).toBeGreaterThan(300)

  // The hover iframe uses the card's real viewport width without a transform.
  const hoverScaleGeometry = await page.evaluate(() => {
    const frame = document.querySelector('.cms-layout-hover-preview iframe')
    const stage = document.querySelector('.cms-layout-hover-preview .cms-layout-preview-stage-scaled')
    const frameRect = frame.getBoundingClientRect()
    const stageRect = stage.getBoundingClientRect()
    const transform = new DOMMatrixReadOnly(getComputedStyle(frame).transform)
    return {
      scaleX: transform.a,
      renderedWidth: frameRect.width,
      stageWidth: stageRect.width,
      renderedHeight: frameRect.height,
      stageHeight: stageRect.height,
    }
  })
  expect(hoverScaleGeometry.scaleX).toBe(1)
  expect(Math.abs(hoverScaleGeometry.renderedWidth - hoverScaleGeometry.stageWidth)).toBeLessThan(1)
  expect(hoverScaleGeometry.renderedHeight).toBeGreaterThan(0)
  expect(hoverScaleGeometry.renderedHeight).toBeLessThanOrEqual(hoverScaleGeometry.stageHeight + 1)

  const optionAfterHover = await leftOption.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  expect(optionAfterHover).toEqual(optionBeforeHover)
  await expect(hoverPreview).toHaveCSS('position', 'fixed')
  await expect(hoverPreview).toBeVisible()
  const anchoredGeometry = await page.evaluate(() => {
    const option = [...document.querySelectorAll('.cms-layout-option')].find(element => element.textContent.includes('À esquerda'))
    const preview = document.querySelector('.cms-layout-hover-preview')
    const optionRect = option.getBoundingClientRect()
    const previewRect = preview.getBoundingClientRect()
    const form = document.querySelector('.cms-layout-form')
    return {
      option: { left: optionRect.left, right: optionRect.right, bottom: optionRect.bottom },
      preview: { left: previewRect.left, right: previewRect.right, top: previewRect.top },
      formWidth: form.getBoundingClientRect().width,
      viewportWidth: window.innerWidth,
    }
  })
  expect(anchoredGeometry.preview.top).toBeGreaterThanOrEqual(anchoredGeometry.option.bottom)
  const isToRight = anchoredGeometry.preview.left >= anchoredGeometry.option.right
  const isToLeft = anchoredGeometry.preview.right <= anchoredGeometry.option.left
  expect(isToRight || isToLeft).toBeTruthy()

  await expect.poll(() => temporaryFrame.evaluate(frame => frame.contentDocument?.querySelector('.site-shell')?.getAttribute('data-layout-hero-align'))).toBe('left')
  const hoverFrameBox = await hoverPreview.locator('.cms-layout-hover-preview-frame').boundingBox()
  await page.mouse.move(hoverFrameBox.x + hoverFrameBox.width / 2, hoverFrameBox.y + hoverFrameBox.height / 2)
  const hoverScrollBefore = await temporaryFrame.evaluate(frame => frame.contentWindow.scrollY)
  await page.mouse.wheel(0, 560)
  await expect.poll(() => temporaryFrame.evaluate(frame => frame.contentWindow.scrollY)).toBe(hoverScrollBefore)
  await expect(temporaryFrame).toHaveAttribute('scrolling', 'no')
  await expect(temporaryFrame).toHaveCSS('pointer-events', 'none')
  await expect(hoverPreview).toBeVisible()
  const previewDocument = page.frameLocator('.cms-layout-hover-preview iframe')
  await expect(previewDocument.locator('.editorial-menu-backdrop')).toHaveAttribute('aria-hidden', 'true')

  const scrollBeforeSelection = await page.evaluate(() => window.scrollY)
  await leftOption.click()
  await expect(leftOption.locator('input')).toBeChecked()
  await expect(hoverPreview).toBeHidden()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBeforeSelection)

  const paletteOption = page.getByRole('button', { name: 'Aplicar paleta Oliva e papel' })
  await paletteOption.hover()
  await expect(hoverPreview).toBeVisible()
  await expect(hoverPreview).toContainText('Oliva e papel')
  await expect.poll(() => temporaryFrame.evaluate(frame => (() => { const shell = frame.contentDocument?.querySelector('.site-shell'); return shell ? frame.contentWindow.getComputedStyle(shell).getPropertyValue('--azul-escuro').trim() : ''; })())).toBe('#171912')
  const backgroundColorOption = page.locator('.cms-layout-color-field').filter({ hasText: 'Fundo' })
  await backgroundColorOption.hover()
  await expect(hoverPreview).toBeVisible()
  await expect(hoverPreview).toContainText('Fundo')

  const experienceGroup = page.locator('.cms-layout-field-group').nth(2)
  await experienceGroup.locator('summary').click()
  const carouselOption = experienceGroup.locator('.cms-layout-option').filter({ hasText: 'Carrossel horizontal' })
  await carouselOption.hover()
  await expect.poll(() => temporaryFrame.evaluate(frame => frame.contentDocument?.querySelector('.site-shell')?.getAttribute('data-layout-presentation'))).toBe('carousel')
  await expect(temporaryFrame).toBeVisible()

  const sidebarOption = experienceGroup.locator('.cms-layout-option').filter({ hasText: 'Painel lateral' })
  await sidebarOption.hover()
  await expect.poll(() => temporaryFrame.evaluate(frame => frame.contentDocument?.querySelector('.site-nav')?.classList.contains('navigation-sidebar'))).toBe(true)
  await expect.poll(() => temporaryFrame.evaluate(frame => frame.contentDocument?.querySelector('.editorial-menu-backdrop')?.getAttribute('aria-hidden'))).toBe('false')
  await expect(sidebarOption.locator('input')).not.toBeChecked()

  const contentGroup = page.locator('.cms-layout-field-group').nth(1)
  await contentGroup.locator('summary').click()
  const hideReferencesOption = contentGroup.locator('.cms-layout-option').filter({ hasText: 'Ocultar referências' })
  await hideReferencesOption.hover()
  await expect.poll(() => temporaryFrame.evaluate(frame => frame.contentDocument?.querySelector('.site-shell')?.getAttribute('data-layout-show-references'))).toBe('false')
  await expect.poll(() => temporaryFrame.evaluate(frame => frame.contentDocument?.querySelector('#Referências')?.hidden)).toBe(true)

  const inlineFrame = page.locator('iframe[title^="Prévia completa do portfólio"]')
  await inlineFrame.scrollIntoViewIfNeeded()
  await expect(inlineFrame).toHaveAttribute('scrolling', 'yes')
  await expect(inlineFrame).toHaveCSS('pointer-events', 'auto')
  await expect.poll(() => inlineFrame.evaluate(frame => frame.getBoundingClientRect().width)).toBeGreaterThan(500)
  const inlineGeometry = await inlineFrame.evaluate(frame => ({
    frame: frame.getBoundingClientRect().width,
    stage: frame.parentElement.getBoundingClientRect().width,
  }))
  expect(Math.abs(inlineGeometry.frame - inlineGeometry.stage)).toBeLessThan(2)

  await page.getByRole('button', { name: 'Abrir janela flutuante' }).click()
  const floatingFrame = page.locator('iframe[title="Prévia flutuante em Desktop"]')
  await expect(floatingFrame).toHaveAttribute('src', '/?layout_preview=1&layout_preview_live=1')
  await expect.poll(() => floatingFrame.evaluate(frame => frame.getBoundingClientRect().width)).toBeGreaterThan(300)
  const floatingPanel = page.locator('.cms-layout-preview-panel.floating')
  const beforePanelWidth = (await floatingPanel.boundingBox()).width
  const beforeResize = await floatingFrame.evaluate(frame => frame.getBoundingClientRect().width)
  const resizeHandle = page.getByRole('button', { name: 'Redimensionar janela de prévia' })
  const handleBox = await resizeHandle.boundingBox()
  expect(handleBox).not.toBeNull()
  expect(handleBox.y + handleBox.height).toBeLessThanOrEqual(page.viewportSize().height)
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 90, handleBox.y + handleBox.height / 2 + 60)
  await page.mouse.up()
  await expect.poll(() => floatingPanel.evaluate(panel => panel.getBoundingClientRect().width)).toBeGreaterThan(beforePanelWidth + 50)
  await expect.poll(() => floatingFrame.evaluate(frame => frame.getBoundingClientRect().width)).toBeGreaterThan(beforeResize + 50)
})


test('prévia contextual permanece acessível e dentro da tela em celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockDashboard(page)
  await page.route('**/api/cms/layout/', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ settings: { hero_alignment: 'center' }, permissions: { canChange: true } }),
  }))
  await page.route('**/api/portfolio/', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ categorias: [], referencias: [], frames: [], redes: [], sobre: null, layout: {} }),
  }))

  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await page.locator('.cms-nav').getByRole('button', { name: /Layout/ }).click()
  const compositionGroup = page.locator('.cms-layout-field-group').first()
  await compositionGroup.locator('summary').click()
  const option = compositionGroup.locator('.cms-layout-option').filter({ hasText: 'À esquerda' })
  await option.scrollIntoViewIfNeeded()
  await option.locator('input').focus()

  const preview = page.locator('.cms-layout-hover-preview')
  await expect(preview).toBeVisible()
  const bounds = await preview.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844)

  await preview.getByRole('button', { name: 'Fechar prévia temporária' }).click()
  await expect(preview).toBeHidden()
  await option.locator('input').check()
  await expect(option.locator('input')).toBeChecked()
})

test('modelos prontos e biblioteca de seções permitem configurar conteúdo especializado', async ({ page }) => {
  let savedSettings = null
  await mockDashboard(page)
  await page.route('**/api/cms/layout/', async route => {
    if (route.request().method() === 'PATCH') savedSettings = route.request().postDataJSON()
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        settings: savedSettings || {
          content_width:'standard',hero_alignment:'center',hero_size:'large',section_spacing:'comfortable',
          gallery_columns:'3',default_gallery_view:'lista',default_theme:'escuro',
          dark_color_background:'#061522',dark_color_surface:'#0b2943',dark_color_text:'#eff7ff',dark_color_muted:'#a9bdcc',dark_color_accent:'#93c8f2',
          light_color_background:'#f5f2eb',light_color_surface:'#ffffff',light_color_text:'#24231f',light_color_muted:'#77746c',light_color_accent:'#657c62',
          show_bio_image:true,show_bio:true,show_references:true,custom_sections:[],
        },
        permissions:{canChange:true},
      }),
    })
  })
  await page.route('**/api/portfolio/', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({categorias:[],referencias:[],frames:[],redes:[],sobre:null,marca:'',layout:{}})}))
  await page.goto('/painel',{waitUntil:'domcontentloaded'})
  await page.locator('.cms-nav').getByRole('button',{name:/Layout/}).click()
  const tattooPreset = page.locator('.cms-layout-preset-card').filter({ hasText: 'Tatuador(a)' })
  await tattooPreset.getByRole('button', { name: /Visualizar modelo/ }).click()
  const inlinePreview = page.locator('.cms-layout-inline-preview')
  await expect(inlinePreview).toContainText('Tatuador(a)')
  await expect(inlinePreview.getByRole('button', { name: 'Confirmar este layout' })).toBeVisible()
  await expect(page.locator('.cms-save-state')).toContainText('Tudo salvo')
  await expect(page.locator('.cms-layout-custom-section')).toHaveCount(0)
  await inlinePreview.getByRole('button', { name: 'Próximo modelo' }).click()
  await expect(inlinePreview).toContainText('7 de 7')
  await inlinePreview.getByRole('button', { name: 'Modelo anterior' }).click()
  await expect(inlinePreview).toContainText('Tatuador(a)')
  await inlinePreview.getByRole('button', { name: 'Confirmar este layout' }).click()
  await expect(page.locator('.cms-save-state')).toContainText('Alterações ainda não salvas')
  await expect(page.locator('.cms-layout-custom-section')).toHaveCount(4)
  const flashSection = page.locator('.cms-layout-custom-section').filter({ hasText: 'Flash disponíveis' }).first()
  const flashEditor = flashSection.locator('details.cms-layout-custom-section-editor').first()
  await expect(flashEditor).not.toHaveAttribute('open', '')
  await flashEditor.locator('summary').click()
  await flashSection.getByRole('button', { name: '+ Adicionar flash' }).click()
  await flashSection.locator('.cms-layout-custom-item summary').click()
  await flashSection.locator('.cms-layout-custom-item input').first().fill('Lua crescente')
  await flashSection.locator('.cms-layout-custom-item textarea').fill('Flash blackwork disponível')
  await page.getByRole('button',{name:'Salvar personalização'}).click()
  await expect.poll(()=>savedSettings?.custom_sections?.[0]?.items?.[0]?.title).toBe('Lua crescente')
})
