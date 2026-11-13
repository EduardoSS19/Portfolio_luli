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

  const leftOption = page.locator('.cms-layout-option').filter({ hasText: 'À esquerda' })
  await leftOption.hover()
  const hoverPreview = page.locator('.cms-layout-hover-preview')
  await expect(hoverPreview).toBeVisible()
  await expect(hoverPreview.getByText('À esquerda', { exact: true })).toBeVisible()
  const temporaryFrame = hoverPreview.locator('iframe[title="Prévia temporária do portfólio"]')
  await expect(temporaryFrame).toHaveAttribute('src', '/?layout_preview=1')
  await expect(leftOption.locator('input')).not.toBeChecked()
  await expect.poll(() => temporaryFrame.evaluate(frame => frame.getBoundingClientRect().width)).toBeGreaterThan(300)

  const overlapsControls = await page.evaluate(() => {
    const preview = document.querySelector('.cms-layout-hover-preview').getBoundingClientRect()
    return [...document.querySelectorAll('.cms-layout-option, .cms-editor-actions button')].some(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 &&
        rect.left < preview.right && rect.right > preview.left &&
        rect.top < preview.bottom && rect.bottom > preview.top
    })
  })
  expect(overlapsControls).toBe(false)

  await leftOption.click()
  await expect(leftOption.locator('input')).toBeChecked()
  await expect(hoverPreview).toHaveClass(/is-empty/)

  const inlineFrame = page.locator('iframe[title^="Prévia completa do portfólio"]')
  await inlineFrame.scrollIntoViewIfNeeded()
  await expect.poll(() => inlineFrame.evaluate(frame => frame.getBoundingClientRect().width)).toBeGreaterThan(500)
  const inlineGeometry = await inlineFrame.evaluate(frame => ({
    frame: frame.getBoundingClientRect().width,
    stage: frame.parentElement.getBoundingClientRect().width,
  }))
  expect(Math.abs(inlineGeometry.frame - inlineGeometry.stage)).toBeLessThan(2)

  await page.getByRole('button', { name: 'Abrir janela flutuante' }).click()
  const floatingFrame = page.locator('iframe[title="Prévia flutuante em Desktop"]')
  await expect.poll(() => floatingFrame.evaluate(frame => frame.getBoundingClientRect().width)).toBeGreaterThan(300)
  const beforeResize = await floatingFrame.evaluate(frame => frame.getBoundingClientRect().width)
  const resizeHandle = page.getByRole('button', { name: 'Redimensionar janela de prévia' })
  const handleBox = await resizeHandle.boundingBox()
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 90, handleBox.y + handleBox.height / 2 + 60)
  await page.mouse.up()
  await expect.poll(() => floatingFrame.evaluate(frame => frame.getBoundingClientRect().width)).toBeGreaterThan(beforeResize + 50)
})
