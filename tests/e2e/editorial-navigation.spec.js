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
