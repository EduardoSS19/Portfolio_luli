import { test, expect } from '@playwright/test'

const categorias = [
  { titulo: 'Glitch Art', chave: 'glitch-art', obras: [
    { titulo: 'Ruído cromático', imagem: '', descricao: 'Estudo de cor e interferência.' },
    { titulo: 'Falha de sinal', imagem: '', descricao: 'Composição digital.' },
  ] },
  { titulo: 'Vídeos', chave: 'videos', obras: [
    { titulo: 'Movimento I', imagem: '', midias: [{ tipo: 'youtube', videoId: 'abcdefghijk', miniatura: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg' }] },
    { titulo: 'Movimento II', imagem: '', descricao: 'Experimento audiovisual.' },
  ] },
  { titulo: 'Cerâmica', chave: 'ceramica', obras: [
    { titulo: 'Forma orgânica', imagem: '', descricao: 'Peça de estudo.' },
    { titulo: 'Vaso azul', imagem: '', descricao: 'Cerâmica experimental.' },
  ] },
  { titulo: 'Desenhos', chave: 'desenhos', obras: [
    { titulo: 'Traço I', imagem: '', descricao: 'Desenho em papel.' },
    { titulo: 'Traço II', imagem: '', descricao: 'Estudo de linha.' },
  ] },
]

async function abrirPortfolio(page, semIntersectionObserver = false) {
  await page.route('**/api/portfolio/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categorias,
      referencias: [],
      frames: [],
      redes: [],
      sobre: { nome: 'Luli', frase: 'Arte e experimentação', bio: 'Artista', email: '', instagram: '', formulario: '' },
    }),
  }))
  if (semIntersectionObserver) {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined })
    })
  }
  await page.goto('/')
  await expect(page.locator('.hero h1')).toHaveText('Luli')
  await page.getByRole('button', { name: 'Visualizar em grade' }).click()
  await expect(page.locator('.galeria-grade-global .obra')).toHaveCount(8)
}

test('a grade mantém todas as categorias e cartões em vários tamanhos, mesmo sem IntersectionObserver', async ({ page, browserName }) => {
  await abrirPortfolio(page, true)

  for (const width of [320, 360, 375, 390, 414, 430, 600, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    const metrics = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.galeria-grade-global .obra')]
      return {
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        cards: cards.length,
        broken: cards.filter(card => {
          const rect = card.getBoundingClientRect()
          return rect.width <= 0 || rect.height <= 0
        }).length,
        hidden: cards.filter(card => getComputedStyle(card).display === 'none').length,
        transparent: cards.filter(card => Number.parseFloat(getComputedStyle(card).opacity) < 0.95).length,
      }
    })

    expect(metrics.cards, `cards at ${width}px`).toBe(8)
    expect(metrics.broken, `invalid card geometry at ${width}px`).toBe(0)
    expect(metrics.hidden, `display:none cards at ${width}px`).toBe(0)
    expect(metrics.scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(metrics.viewport + 1)
    if (width <= 600 || browserName === 'webkit') {
      expect(metrics.transparent, `transparent cards at ${width}px`).toBe(0)
    }
  }
})

test('alternar lista e grade preserva as oito obras', async ({ page }) => {
  await abrirPortfolio(page)
  await page.getByRole('button', { name: 'Visualizar em lista' }).click()
  await expect(page.locator('.galeria-grade-global')).toHaveCount(0)
  await expect(page.locator('.secao .obra')).toHaveCount(8)
})
