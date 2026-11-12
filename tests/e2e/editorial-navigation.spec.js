import { test, expect } from '@playwright/test'

const categorias = [
  { titulo: 'Início', chave: 'inicio' },
  { titulo: 'Cerâmica', chave: 'ceramica' },
  { titulo: 'Glitch Art', chave: 'glitch-art' },
  { titulo: 'Referências', chave: 'referencias' },
  { titulo: 'Contato', chave: 'contato' },
]

async function abrirPortfolio(page) {
  await page.route('**/api/portfolio/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categorias: categorias.slice(1, 3).map(cat => ({ ...cat, obras: [] })),
      referencias: [],
      frames: [],
      redes: [],
      sobre: { nome: 'Luli', frase: 'Arte e experimentação', bio: 'Artista', email: '', instagram: '', formulario: '' },
    }),
  }))
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luli')
}

test('menu editorial abre em tela cheia, navega e fecha após selecionar uma seção', async ({ page }) => {
  await abrirPortfolio(page)
  const trigger = page.getByRole('button', { name: /menu/i })
  await expect(trigger).toBeVisible()
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: 'Menu do portfólio' })
  await expect(dialog).toBeVisible()
  const link = dialog.getByRole('button', { name: /cerâmica/i })
  await expect(link).toBeVisible()
  await link.click()

  await expect(dialog).toBeHidden()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
})

test('Escape fecha o menu e devolve o foco ao botão que o abriu', async ({ page }) => {
  await abrirPortfolio(page)
  const trigger = page.getByRole('button', { name: /menu/i })
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('menu editorial mantém alvos de toque e conteúdo dentro da tela em celulares', async ({ page }) => {
  await abrirPortfolio(page)
  await page.getByRole('button', { name: /menu/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  for (const width of [320, 360, 375, 390, 414]) {
    await page.setViewportSize({ width, height: 844 })
    const metrics = await page.evaluate(() => {
      const trigger = document.querySelector('.editorial-menu-trigger').getBoundingClientRect()
      const overlay = document.querySelector('.editorial-menu-backdrop').getBoundingClientRect()
      const links = [...document.querySelectorAll('.nav-overlay-link')]
      return {
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        triggerWidth: trigger.width,
        triggerHeight: trigger.height,
        overlayWidth: overlay.width,
        overlayHeight: overlay.height,
        links: links.map(link => {
          const rect = link.getBoundingClientRect()
          return { width: rect.width, height: rect.height, right: rect.right, left: rect.left }
        }),
      }
    })
    expect(metrics.scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(metrics.viewport + 1)
    expect(metrics.triggerWidth).toBeGreaterThanOrEqual(44)
    expect(metrics.triggerHeight).toBeGreaterThanOrEqual(44)
    expect(metrics.overlayWidth).toBeGreaterThanOrEqual(width - 1)
    expect(metrics.overlayHeight).toBeGreaterThanOrEqual(844 - 1)
    for (const link of metrics.links) {
      expect(link.height).toBeGreaterThanOrEqual(44)
      expect(link.left).toBeGreaterThanOrEqual(-1)
      expect(link.right).toBeLessThanOrEqual(width + 1)
    }
  }
})

test('navegação por toque fecha o menu e rola até a seção no mobile', async ({ browser, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox não oferece contexto mobile com isMobile; a cobertura mobile roda em Chromium e WebKit.')
  // Este teste roda no projeto chromium-desktop do CI, então cria explicitamente
  // um contexto mobile com suporte a toque em vez de depender do device do projeto.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()

  try {
    await abrirPortfolio(page)
    const trigger = page.locator('.editorial-menu-trigger')
    await trigger.tap()
    const dialog = page.getByRole('dialog', { name: 'Menu do portfólio' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /cerâmica/i }).tap()
    await expect(dialog).toBeHidden()
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeGreaterThan(100)
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  } finally {
    await context.close()
  }
})

test('links do menu recebem entrada escalonada e títulos de seção podem animar', async ({ page }) => {
  await abrirPortfolio(page)
  await page.locator('.editorial-menu-trigger').click()
  const link = page.locator('.nav-overlay-link').filter({ hasText: 'Cerâmica' })
  await expect(link).toHaveClass(/entrada-ceramica/)
  await expect(link).toHaveAttribute('style', /--menu-index/)
  await link.click()
  await expect(page.locator('.secao-cabecalho.arte-ceramica')).toBeVisible()
})


test('menu reúne tema claro/escuro e alternância única entre lista e grade', async ({ page }) => {
  await abrirPortfolio(page)
  await page.locator('.editorial-menu-trigger').click()
  const dialog = page.getByRole('dialog', { name: 'Menu do portfólio' })
  const tema = dialog.getByRole('button', { name: 'Ativar tema claro' })
  await expect(tema).toBeVisible()
  await tema.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'claro')
  await expect(dialog.getByRole('button', { name: 'Ativar tema escuro' })).toBeVisible()

  const alternar = dialog.getByRole('button', { name: 'Alternar para visualização em grade' })
  await expect(alternar).toBeVisible()
  await alternar.click()
  await expect(page.locator('.galeria-grade-global')).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(page.locator('.editorial-menu-trigger')).toHaveAttribute('aria-expanded', 'false')
})
