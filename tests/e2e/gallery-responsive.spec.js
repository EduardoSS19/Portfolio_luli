import { test, expect } from '@playwright/test'

const imagemTeste = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 100%22%3E%3Crect width=%2280%22 height=%22100%22 fill=%22%231e6688%22/%3E%3Ccircle cx=%2240%22 cy=%2250%22 r=%2220%22 fill=%22%23f5d6a2%22/%3E%3C/svg%3E'

const categorias = [
  { titulo: 'Glitch Art', chave: 'glitch-art', obras: [
    { titulo: 'Ruído cromático', imagem: imagemTeste, midias: [{ tipo: 'imagem', src: imagemTeste }, { tipo: 'imagem', src: imagemTeste }], descricao: 'Estudo de cor e interferência.' },
    { titulo: 'Falha de sinal', imagem: imagemTeste, descricao: 'Composição digital.' },
  ] },
  { titulo: 'Vídeos', chave: 'videos', obras: [
    { titulo: 'Movimento I', imagem: '', midias: [{ tipo: 'youtube', videoId: 'abcdefghijk', miniatura: imagemTeste }] },
    { titulo: 'Movimento II', imagem: imagemTeste, descricao: 'Experimento audiovisual.' },
  ] },
  { titulo: 'Cerâmica', chave: 'ceramica', obras: [
    { titulo: 'Forma orgânica', imagem: imagemTeste, descricao: 'Peça de estudo.' },
    { titulo: 'Vaso azul', imagem: imagemTeste, descricao: 'Cerâmica experimental.' },
  ] },
  { titulo: 'Desenhos', chave: 'desenhos', obras: [
    { titulo: 'Traço I', imagem: imagemTeste, descricao: 'Desenho em papel.' },
    { titulo: 'Traço II', imagem: imagemTeste, descricao: 'Estudo de linha.' },
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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luli')
  await page.getByRole('button', { name: 'Visualizar em grade' }).click()
  const primeiroCard = page.locator('.galeria-grade-global .obra').first()
  await expect(page.locator('.galeria-grade-global .obra')).toHaveCount(8)
  // Com IntersectionObserver ativo, apenas cards próximos ao viewport devem revelar.
  // Leva o primeiro card à área visível e aguarda sua transição, sem exigir que
  // os demais cards (ainda fora da tela) fiquem visíveis antes do scroll.
  await primeiroCard.scrollIntoViewIfNeeded()
  await expect.poll(() => primeiroCard.evaluate(card =>
    Number.parseFloat(getComputedStyle(card).opacity)
  ), { timeout: 5000 }).toBeGreaterThanOrEqual(0.95)
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
  await expect(page.locator('.secao:not(.sobre-secao) .obras-lista .obra')).toHaveCount(8)
})


test('a navegação mantém as categorias disponíveis e acompanha a grade', async ({ page }) => {
  await abrirPortfolio(page)
  const menu = page.locator('.nav-mobile-toggle')
  const categoriasTeste = [
    ['Glitch Art', 'glitch-art'],
    ['Vídeos', 'videos'],
    ['Cerâmica', 'ceramica'],
    ['Desenhos', 'desenhos'],
  ]
  for (const [titulo, chave] of categoriasTeste) {
    // Em telas móveis, selecionar uma categoria fecha o menu por design.
    // Reabre antes de cada seleção; em desktop os links já ficam expostos.
    if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') {
      await menu.click()
    }
    const item = page.locator('.nav-links button').filter({ hasText: titulo })
    await expect(item).toBeVisible()
    await item.click()
    const primeiroCard = page.locator(`.galeria-grade-global .obra.categoria-${chave}`).first()
    await expect(primeiroCard).toBeVisible()
    await expect(item).toHaveAttribute('aria-current', 'location')
  }
})

test('o modo leve não remove animações artísticas e movimento reduzido continua respeitado', async ({ page }) => {
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
  await page.goto('/?leve')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luli')
  await page.getByRole('button', { name: 'Visualizar em grade' }).click()
  const glitch = page.locator('.galeria-grade-global .obra.arte-glitch').first()
  await glitch.scrollIntoViewIfNeeded()
  await expect.poll(() => glitch.evaluate(card => getComputedStyle(card.querySelector('.obra-zoom-trigger img')).animationName)).toContain('glitchConstrucao')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(() => glitch.evaluate(card => getComputedStyle(card.querySelector('.obra-zoom-trigger img')).animationName)).toBe('none')
})



const imagemFotoReal = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Still_Life_Photography.jpg/640px-Still_Life_Photography.jpg'

test('fotos reais ocupam o card inteiro no grid mobile sem quebrar vídeo ou glitch', async ({ page }, testInfo) => {
  const categoriasComFoto = [
    { titulo: 'Cerâmica', chave: 'ceramica', obras: [{ titulo: 'Foto cerâmica', imagem: imagemFotoReal, midias: [{ tipo: 'imagem', src: imagemFotoReal }] }] },
    { titulo: 'Gravura', chave: 'gravura', obras: [{ titulo: 'Foto gravura', imagem: imagemFotoReal, midias: [{ tipo: 'imagem', src: imagemFotoReal }] }] },
    { titulo: 'Desenhos', chave: 'desenhos', obras: [{ titulo: 'Foto desenho', imagem: imagemFotoReal, midias: [{ tipo: 'imagem', src: imagemFotoReal }] }] },
    { titulo: 'Fotografia', chave: 'fotografia', obras: [{ titulo: 'Foto real', imagem: imagemFotoReal, midias: [{ tipo: 'imagem', src: imagemFotoReal }] }] },
    { titulo: 'Outras obras', chave: 'outras', obras: [{ titulo: 'Foto sem técnica', imagem: imagemFotoReal, midias: [{ tipo: 'imagem', src: imagemFotoReal }] }] },
    { titulo: 'Glitch Art', chave: 'glitch-art', obras: [{ titulo: 'Glitch preservado', imagem: imagemFotoReal, midias: [{ tipo: 'imagem', src: imagemFotoReal }] }] },
    { titulo: 'Vídeos', chave: 'videos', obras: [{ titulo: 'Vídeo preservado', imagem: imagemFotoReal, midias: [{ tipo: 'youtube', videoId: 'abcdefghijk', miniatura: imagemFotoReal }] }] },
  ]

  await page.route('**/api/portfolio/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categorias: categoriasComFoto,
      referencias: [],
      frames: [],
      redes: [],
      sobre: { nome: 'Luli', frase: 'Arte e experimentação', bio: 'Artista', email: '', instagram: '', formulario: '' },
    }),
  }))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luli')
  await page.getByRole('button', { name: 'Visualizar em grade' }).click()

  const cards = page.locator('.galeria-grade-global .obra')
  await expect(cards).toHaveCount(7)
  await expect.poll(() => page.locator('.galeria-grade-global img').evaluateAll(images =>
    images.filter(img => img.complete && img.naturalWidth > 0).length
  ), { timeout: 20000 }).toBeGreaterThanOrEqual(7)

  for (const width of [320, 360, 375, 390, 414]) {
    await page.setViewportSize({ width, height: 844 })
    for (const chave of ['ceramica', 'gravura', 'desenhos', 'fotografia', 'outras']) {
      const card = page.locator(`.galeria-grade-global .obra.categoria-${chave}`)
      await card.scrollIntoViewIfNeeded()
      const metrics = await card.evaluate(element => {
        const cardRect = element.getBoundingClientRect()
        const button = element.querySelector('.obra-zoom-trigger')
        const image = button?.querySelector('img')
        const buttonRect = button?.getBoundingClientRect()
        const imageRect = image?.getBoundingClientRect()
        const style = image ? getComputedStyle(image) : null
        return {
          cardWidth: cardRect.width,
          cardHeight: cardRect.height,
          buttonWidth: buttonRect?.width ?? 0,
          buttonHeight: buttonRect?.height ?? 0,
          imageWidth: imageRect?.width ?? 0,
          imageHeight: imageRect?.height ?? 0,
          naturalWidth: image?.naturalWidth ?? 0,
          clipPath: style?.clipPath ?? 'missing',
          transform: style?.transform ?? 'missing',
          animation: style?.animationName ?? 'missing',
        }
      })
      expect(metrics.cardWidth, `${chave} card width at ${width}px`).toBeGreaterThan(120)
      expect(metrics.cardHeight, `${chave} card height at ${width}px`).toBeGreaterThan(150)
      expect(metrics.buttonWidth, `${chave} button width at ${width}px`).toBeGreaterThan(metrics.cardWidth * 0.9)
      expect(metrics.buttonHeight, `${chave} button height at ${width}px`).toBeGreaterThan(metrics.cardHeight * 0.9)
      expect(metrics.imageWidth, `${chave} image width at ${width}px`).toBeGreaterThan(metrics.cardWidth * 0.9)
      expect(metrics.imageHeight, `${chave} image height at ${width}px`).toBeGreaterThan(metrics.cardHeight * 0.9)
      expect(metrics.naturalWidth, `${chave} real photo loaded at ${width}px`).toBeGreaterThan(100)
      if (testInfo.project.name === 'webkit-iphone' || testInfo.project.name === 'chromium-android') {
        expect(metrics.clipPath, `${chave} image clip-path at ${width}px`).toBe('none')
        expect(metrics.transform, `${chave} image transform at ${width}px`).toBe('none')
        expect(metrics.animation, `${chave} image animation at ${width}px`).toBe('none')
      }
    }
  }

  const glitch = page.locator('.galeria-grade-global .obra.arte-glitch')
  await glitch.scrollIntoViewIfNeeded()
  await expect.poll(() => glitch.locator('.obra-zoom-trigger img').evaluate(img => getComputedStyle(img).animationName)).toContain('glitchConstrucao')

  const video = page.locator('.galeria-grade-global .obra.midia-video')
  await video.scrollIntoViewIfNeeded()
  await expect.poll(() => video.locator('.obra-video-trigger img').evaluate(img => getComputedStyle(img).animationName)).toContain('videoLigada')
})

test('a grade exibe as obras mesmo sem IntersectionObserver e carrega as miniaturas', async ({ page }) => {
  await abrirPortfolio(page, true)
  const cards = page.locator('.galeria-grade-global .obra')
  await expect(cards).toHaveCount(8)
  for (let i = 0; i < 8; i++) {
    const card = cards.nth(i)
    await expect.poll(() => card.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity))).toBeGreaterThanOrEqual(0.95)
  }
  await expect.poll(() => cards.first().locator('.obra-zoom-trigger img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
})

test('a grade não renderiza a faixa de miniaturas e mantém a galeria completa no foco', async ({ page }) => {
  await abrirPortfolio(page)
  const card = page.locator('.galeria-grade-global .obra').first()
  await expect(card.locator('.carrossel-miniaturas')).toHaveCount(0)
  await expect(card.locator('.grade-midia-contagem')).toHaveText('+1')
  await card.locator('.obra-zoom-trigger').click()
  const dialog = page.getByLabel('Visualização ampliada de Ruído cromático')
  await expect(dialog).toHaveAttribute('open', '')
  await expect(dialog.locator('.obra-focus-proxima')).toBeVisible()
  await dialog.locator('.obra-focus-proxima').click()
  await expect(dialog.locator('.obra-focus-contagem')).toContainText('02')
})
