import { test, expect } from '@playwright/test'

test('conteúdo complementar carrega redes sociais e referências no painel', async ({ page }) => {
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
      const type = url.searchParams.get('type')
      const results = type === 'social-links'
        ? [{ id: 1, title: 'Behance', url: 'https://behance.net/artista', position: 0, active: true }]
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

  await page.locator('.cms-content-tabs button').nth(1).click()
  await expect(page.locator('.cms-content-tabs button').nth(1)).toHaveClass(/active/)
  await expect(page.locator('.cms-content-intro h2')).toHaveText('Referências')
  await expect(page.getByText('Exposição coletiva', { exact: true })).toBeVisible()
})
