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
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
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
  await expect(page.getByRole('status')).toContainText('Item adicionado')
  await expect(page.getByLabel('Nome da rede social')).toHaveValue('')
})
