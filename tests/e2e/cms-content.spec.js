import { test, expect } from '@playwright/test'

test('conteúdo complementar carrega redes sociais e referências no painel', async ({ page }) => {
  let socialLinks = [
    { id: 1, title: 'Behance', url: 'https://behance.net/artista', position: 0, active: true },
    { id: 4, title: 'Instagram', url: 'https://instagram.com/artista', position: 1, active: true },
  ]
  let savedOrder = null
  await page.route('**/api/cms/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/api/cms/overview/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        works: { total: 0, published: 0, drafts: 0 },
        categories: 0,
        categoryOptions: [],
        references: 1,
        videos: 0,
        permissions: { canCreateWork: false, canEditWork: false, canDeleteWork: false },
      }) })
    }
    if (url.pathname.endsWith('/api/cms/works/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        results: [], pagination: { total: 0, hasMore: false },
      }) })
    }
    if (url.pathname.endsWith('/api/cms/analytics/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        status: 'not_configured', historical: null, realtime: null,
      }) })
    }
    if (url.pathname.endsWith('/api/cms/content/')) {
      if (route.request().method() === 'PATCH') {
        const payload = route.request().postDataJSON()
        savedOrder = payload.ids
        socialLinks = payload.ids.map((id, index) => ({ ...socialLinks.find(item => item.id === id), position: index }))
      }
      const type = url.searchParams.get('type') || route.request().postDataJSON()?.type
      const results = type === 'social-links'
        ? socialLinks
        : type === 'references'
          ? [{ id: 2, title: 'Exposição coletiva', period: '2026', position: 0, active: true, links: [{ id: 3, text: 'Catálogo', url: 'https://example.com/catalogo', position: 0 }] }]
          : []
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        results, permissions: { canView: true, canAdd: true, canChange: true, canDelete: true },
      }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  })

  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Olá')
  await page.locator('.cms-nav').getByRole('button', { name: /Conteúdo/ }).click()

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Conteúdo complementar')
  await expect(page.getByText('Behance', { exact: true })).toBeVisible()
  await expect(page.getByText('Instagram', { exact: true })).toBeVisible()

  const contentRows = page.locator('.cms-content-item')
  await expect(contentRows).toHaveCount(2)
  await contentRows.nth(0).dragTo(contentRows.nth(1))
  await expect.poll(() => savedOrder).toEqual([4, 1])

  await page.locator('.cms-content-tabs button').nth(1).click()
  await expect(page.locator('.cms-content-tabs button').nth(1)).toHaveClass(/active/)
  await expect(page.locator('.cms-content-intro h2')).toHaveText('Referências')
  await expect(page.getByText('Exposição coletiva', { exact: true })).toBeVisible()
})


test('biblioteca central lista e transfere mídias entre obras', async ({ page }) => {
  await page.route('**/api/cms/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/api/cms/overview/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        works: { total: 2, published: 2, drafts: 0 },
        categories: 1,
        categoryOptions: [{ id: 1, key: 'arte', title: 'Arte' }],
        references: 0,
        videos: 0,
        permissions: { canCreateWork: false, canEditWork: true, canDeleteWork: false },
      }) })
    }
    if (url.pathname.endsWith('/api/cms/works/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        results: [], pagination: { total: 0, hasMore: false },
      }) })
    }
    if (url.pathname.endsWith('/api/cms/analytics/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        status: 'not_configured', historical: null, realtime: null,
      }) })
    }
    if (url.pathname.endsWith('/api/cms/media/move/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        moved: true, id: 7, type: 'image', workId: 2, workTitle: 'Obra destino', position: 0,
      }) })
    }
    if (url.pathname.endsWith('/api/cms/media/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        results: [{
          id: 7, type: 'image', workId: 1, workTitle: 'Obra origem',
          categoryTitle: 'Arte', position: 0, title: 'Foto 01',
          detail: 'foto.png', preview: '', youtubeUrl: '',
        }],
        works: [
          { id: 1, title: 'Obra origem', categoryTitle: 'Arte' },
          { id: 2, title: 'Obra destino', categoryTitle: 'Arte' },
        ],
        total: 1, limit: 500, offset: 0, hasMore: false,
      }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  })

  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await page.locator('.cms-nav').getByRole('button', { name: /Mídias/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Biblioteca de mídias')
  await expect(page.getByText('Foto 01', { exact: true })).toBeVisible()

  await page.getByLabel('Obra de destino para Foto 01').selectOption('2')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Transferir' }).click()
  await expect(page.getByRole('status')).toContainText('Mídia transferida para "Obra destino"')
})
