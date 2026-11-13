import { test, expect } from '@playwright/test'

const imagemTeste = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 100%22%3E%3Crect width=%2280%22 height=%22100%22 fill=%22%231e6688%22/%3E%3Ccircle cx=%2240%22 cy=%2250%22 r=%2220%22 fill=%22%23f5d6a2%22/%3E%3C/svg%3E'
const imagemTesteAlternativa = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 100%22%3E%3Crect width=%2280%22 height=%22100%22 fill=%22%23883b66%22/%3E%3Ccircle cx=%2240%22 cy=%2250%22 r=%2220%22 fill=%22%23a2e5f5%22/%3E%3C/svg%3E'

const categorias = [
  { titulo: 'Glitch Art', chave: 'glitch-art', obras: [
    { titulo: 'Ruído cromático', imagem: imagemTeste, midias: [{ tipo: 'imagem', src: imagemTeste }, { tipo: 'imagem', src: imagemTesteAlternativa }], descricao: 'Estudo de cor e interferência.' },
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

async function alternarModoGaleria(page, nomeBotao) {
  const menu = page.locator('.editorial-menu-trigger')
  if (await menu.getAttribute('aria-expanded') !== 'true') {
    await menu.click()
    await expect(page.getByRole('dialog')).toBeVisible()
  }
  await page.locator('.editorial-menu-controls').getByRole('button', { name: nomeBotao }).click()
}


async function aguardarQuadroEstavel(locator) {
  // Fechar <dialog> pode disparar restauração de foco e scroll em uma tarefa
  // posterior. Aguarda quatro frames consecutivos com a geometria do card
  // estável antes de comparar a posição final (sem ampliar a tolerância).
  await locator.evaluate(element => new Promise(resolve => {
    let anterior = null
    let quadrosEstaveis = 0

    function verificar() {
      const rect = element.getBoundingClientRect()
      const atual = [rect.x + window.scrollX, rect.y + window.scrollY, rect.width, rect.height]
      if (anterior && atual.every((valor, indice) => Math.abs(valor - anterior[indice]) <= 0.25)) {
        quadrosEstaveis += 1
      } else {
        quadrosEstaveis = 0
      }
      anterior = atual
      if (quadrosEstaveis >= 4) {
        resolve()
      } else {
        requestAnimationFrame(verificar)
      }
    }

    requestAnimationFrame(verificar)
  }))
}

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
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luli')
  await page.locator('.editorial-menu-trigger').click()
  await alternarModoGaleria(page, 'Alternar para visualização em grade')
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
  await alternarModoGaleria(page, 'Alternar para visualização em lista')
  await expect(page.locator('.galeria-grade-global')).toHaveCount(0)
  await expect(page.locator('.secao:not(.sobre-secao) .obras-lista .obra')).toHaveCount(8)
})


test('a navegação mantém as categorias disponíveis e acompanha a grade', async ({ page }) => {
  await abrirPortfolio(page)
  const menu = page.locator('.editorial-menu-trigger')
  const categoriasTeste = [
    ['Glitch Art', 'glitch-art'],
    ['Vídeos', 'videos'],
    ['Cerâmica', 'ceramica'],
    ['Desenhos', 'desenhos'],
  ]
  for (const [titulo, chave] of categoriasTeste) {
    if (await menu.getAttribute('aria-expanded') !== 'true') await menu.click()
    const item = page.locator('.nav-overlay-link').filter({ hasText: titulo })
    await expect(item).toBeVisible()
    await item.click()
    const primeiroCard = page.locator(`.galeria-grade-global .obra.categoria-${chave}`).first()
    await expect(primeiroCard).toBeVisible()
    await primeiroCard.scrollIntoViewIfNeeded()
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
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
  await page.goto('/?leve', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luli')
  await page.locator('.editorial-menu-trigger').click()
  await alternarModoGaleria(page, 'Alternar para visualização em grade')
  const glitch = page.locator('.galeria-grade-global .obra.arte-glitch').first()
  await glitch.scrollIntoViewIfNeeded()
  await expect.poll(() => glitch.evaluate(card => getComputedStyle(card.querySelector('.obra-zoom-trigger img')).animationName)).toContain('glitchConstrucao')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(() => glitch.evaluate(card => getComputedStyle(card.querySelector('.obra-zoom-trigger img')).animationName)).toBe('none')
})



// JPEG local embutido: o teste não depende de rede externa nem de CDN.
const imagemFotoReal = 'data:image/jpeg;base64,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'

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
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luli')
  await page.locator('.editorial-menu-trigger').click()
  await alternarModoGaleria(page, 'Alternar para visualização em grade')

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
      // Aguarda a animação artística inicial terminar antes de medir a caixa renderizada:
      // alguns keyframes (ex.: cerâmica no torno) aplicam scale/clip-path durante a entrada.
      await expect.poll(() => card.locator('.obra-zoom-trigger img').evaluate(image =>
        image.getAnimations().every(animation => animation.playState === 'finished')
      ), { timeout: 5000 }).toBe(true)
      const metrics = await card.evaluate(element => {
        const cardRect = element.getBoundingClientRect()
        const gallery = element.querySelector('.obra-galeria')
        const media = element.querySelector('.obra-imagem')
        const button = element.querySelector('.obra-zoom-trigger')
        const image = button?.querySelector('img')
        const galleryRect = gallery?.getBoundingClientRect()
        const mediaRect = media?.getBoundingClientRect()
        const buttonRect = button?.getBoundingClientRect()
        const imageRect = image?.getBoundingClientRect()
        const style = image ? getComputedStyle(image) : null
        return {
          cardWidth: cardRect.width,
          cardHeight: cardRect.height,
          galleryWidth: galleryRect?.width ?? 0,
          galleryHeight: galleryRect?.height ?? 0,
          mediaWidth: mediaRect?.width ?? 0,
          mediaHeight: mediaRect?.height ?? 0,
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
      expect(metrics.galleryWidth, `${chave} gallery width at ${width}px`).toBeGreaterThan(metrics.cardWidth * 0.9)
      expect(metrics.galleryHeight, `${chave} gallery height at ${width}px`).toBeGreaterThan(metrics.cardHeight * 0.9)
      expect(metrics.mediaWidth, `${chave} media width at ${width}px`).toBeGreaterThan(metrics.cardWidth * 0.9)
      expect(metrics.mediaHeight, `${chave} media height at ${width}px`).toBeGreaterThan(metrics.cardHeight * 0.9)
      expect(metrics.buttonWidth, `${chave} button width at ${width}px`).toBeGreaterThan(metrics.cardWidth * 0.9)
      expect(metrics.buttonHeight, `${chave} button height at ${width}px`).toBeGreaterThan(metrics.cardHeight * 0.9)
      expect(metrics.imageWidth, `${chave} image width at ${width}px`).toBeGreaterThan(metrics.cardWidth * 0.9)
      expect(metrics.imageHeight, `${chave} image height at ${width}px`).toBeGreaterThan(metrics.cardHeight * 0.9)
      expect(metrics.naturalWidth, `${chave} real photo loaded at ${width}px`).toBeGreaterThan(100)
      const animacoesPorTecnica = {
        ceramica: 'ceramicaNoTorno',
        gravura: 'gravuraPrensa',
        desenhos: 'desenhoEsbocado',
        fotografia: 'fotoRevelada',
        outras: 'obraRevelada',
      }
      if (testInfo.project.name === 'webkit-iphone' || testInfo.project.name === 'chromium-android') {
        expect(metrics.animation).toContain(animacoesPorTecnica[chave])
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

test('em qualquer viewport touch a grade mantém o +N e esconde as setas', async ({ page }, testInfo) => {
  await abrirPortfolio(page)
  const viewports = ['webkit-iphone', 'chromium-android'].includes(testInfo.project.name)
    ? [390, 768, 820, 1024]
    : [390]

  for (const width of viewports) {
    await page.setViewportSize({ width, height: 900 })
    if (['webkit-iphone', 'chromium-android'].includes(testInfo.project.name)) {
      expect(await page.evaluate(() => matchMedia('(hover: none), (pointer: coarse)').matches))
        .toBe(true)
    }
    const card = page.locator('.galeria-grade-global .obra.tem-carrossel').first()
    const contador = card.locator('.grade-midia-contagem')
    await expect(contador).toContainText('+')
    await expect(contador).toBeVisible()
    await expect(card.locator('.carrossel-seta')).toHaveCount(2)
    await expect(card.locator('.carrossel-seta').first()).toBeHidden()
    await expect(card.locator('.carrossel-seta').last()).toBeHidden()
  }
})

test('na lista desktop, o texto do carrossel fica centralizado verticalmente', async ({ page }) => {
  await abrirPortfolio(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await alternarModoGaleria(page, 'Alternar para visualização em lista')
  const texto = page.locator('.secao:not(.sobre-secao) .obra.tem-carrossel .obra-texto').first()
  await expect(texto).toBeVisible()
  await expect(texto).toHaveCSS('justify-content', 'center')
})

test('fechar o foco durante o zoom de abertura reverte a partir do quadro atual e limpa a animação', async ({ page }) => {
  // O zoom real dura 640 ms: observar a transformação renderizada evita
  // depender de monkeypatch de WAAPI, que varia entre engines e dispositivos.
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await abrirPortfolio(page)
  await page.setViewportSize({ width: 390, height: 844 })

  const card = page.locator('.galeria-grade-global .obra').first()
  await card.locator('.obra-zoom-trigger').click()
  const dialog = page.getByLabel('Visualização ampliada de Ruído cromático')
  await expect(dialog).toHaveAttribute('open', '')
  const imagem = dialog.locator('.obra-focus-imagem')

  const transformacaoInicial = await imagem.evaluate(element => getComputedStyle(element).transform)
  await expect.poll(() => imagem.evaluate(element => getComputedStyle(element).transform))
    .not.toBe(transformacaoInicial)

  // Confirma que o quadro continua evoluindo antes de interromper a abertura.
  const transformacaoIntermediaria = await imagem.evaluate(element => getComputedStyle(element).transform)
  await page.waitForTimeout(120)
  await expect.poll(() => imagem.evaluate(element => getComputedStyle(element).transform))
    .not.toBe(transformacaoIntermediaria)

  await dialog.getByRole('button', { name: 'Fechar visualização' }).click()
  await expect(dialog).not.toHaveAttribute('open', '')
  await expect.poll(() => imagem.evaluate(element => getComputedStyle(element).transform)).toBe('none')
  await expect(card.locator('.obra-zoom-trigger')).toBeVisible()
})

test('abrir e fechar o foco repetidamente não deixa transformações residuais na imagem', async ({ page }) => {
  await abrirPortfolio(page)
  await page.setViewportSize({ width: 390, height: 844 })

  const card = page.locator('.galeria-grade-global .obra').first()
  const dialog = page.getByLabel('Visualização ampliada de Ruído cromático')
  const imagem = dialog.locator('.obra-focus-imagem')

  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    await card.locator('.obra-zoom-trigger').click()
    await expect(dialog).toHaveAttribute('open', '')
    await expect(dialog.getByRole('button', { name: 'Fechar visualização' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Fechar visualização' }).click()
    await expect(dialog).not.toHaveAttribute('open', '')
    await expect.poll(() => imagem.evaluate(element => getComputedStyle(element).transform)).toBe('none')
    await expect.poll(() => imagem.evaluate(element => getComputedStyle(element).clipPath)).toBe('none')
  }
})


test('no foco mobile, a obra e o título aparecem antes das informações adicionais', async ({ page }) => {
  await abrirPortfolio(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const card = page.locator('.galeria-grade-global .obra').first()
  await card.locator('.obra-zoom-trigger').click()
  const dialog = page.getByLabel('Visualização ampliada de Ruído cromático')
  await expect(dialog).toHaveAttribute('open', '')
  await expect(dialog.locator('.obra-focus-caption h2')).toHaveText('Ruído cromático')
  const metadados = dialog.locator('.obra-focus-metadados')
  await expect(metadados).toBeHidden()
  const toggle = dialog.getByRole('button', { name: 'Ver informações da obra' })
  await expect(toggle).toBeVisible()
  await toggle.click()
  const toggleAberto = dialog.getByRole('button', { name: 'Ocultar informações' })
  await expect(toggleAberto).toHaveAttribute('aria-expanded', 'true')
  await expect(metadados).toBeVisible()
  await expect(metadados).toContainText('Estudo de cor e interferência.')
  await toggleAberto.click()
  await expect(metadados).toBeHidden()
})

test('a grade indica carrossel com +N e setas, sem miniaturas ou contador duplicado', async ({ page }) => {
  await abrirPortfolio(page)
  const card = page.locator('.galeria-grade-global .obra').first()
  await expect(card.locator('.carrossel-miniaturas')).toHaveCount(0)
  await expect(card.locator('.grade-midia-contagem')).toHaveText('+1 imagem')
  await expect(card.locator('.carrossel-indice')).toHaveCount(0)
  // O botão continua no DOM para acessibilidade, mesmo quando CSS o oculta em touch.
  const proxima = card.locator('.carrossel-seta.carrossel-proxima')
  await expect(proxima).toHaveCount(1)
  const touch = await page.evaluate(() => matchMedia('(hover: none), (pointer: coarse)').matches)
  if (touch) {
    // Em touch a navegação é por gesto; o +N substitui as setas visuais.
    await expect(proxima).toBeHidden()
  } else {
    await expect(proxima).toBeVisible()
    await proxima.click()
  }
  await expect(card.locator('.carrossel-indice')).toHaveCount(0)
  await card.locator('.obra-zoom-trigger').click()
  const dialog = page.getByLabel('Visualização ampliada de Ruído cromático')
  await expect(dialog).toHaveAttribute('open', '')
  await expect(dialog.locator('.obra-focus-proxima')).toBeVisible()
  await dialog.locator('.obra-focus-proxima').click()
  await expect(dialog.locator('.obra-focus-contagem')).toContainText('02')
})

test('navegar no foco e fechar preserva a capa do card sem recarregamento no mobile', async ({ page }, testInfo) => {
  await abrirPortfolio(page)
  if (testInfo.project.name === 'chromium-android') {
    await page.setViewportSize({ width: 390, height: 844 })
  }

  const card = page.locator('.galeria-grade-global .obra.tem-carrossel').first()
  const miniatura = card.locator('.obra-zoom-trigger img')
  await card.scrollIntoViewIfNeeded()
  await expect.poll(() => miniatura.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
  const capaOriginal = await miniatura.getAttribute('src')

  await card.locator('.obra-zoom-trigger').click()
  const dialog = page.getByLabel('Visualização ampliada de Ruído cromático')
  await expect(dialog).toHaveAttribute('open', '')
  const imagemAmpliada = dialog.locator('.obra-focus-imagem')
  await expect.poll(() => imagemAmpliada.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)

  await dialog.locator('.obra-focus-proxima').click()
  await expect.poll(() => imagemAmpliada.getAttribute('src')).not.toBe(capaOriginal)
  await expect(miniatura).toHaveAttribute('src', capaOriginal)

  await dialog.getByRole('button', { name: 'Fechar visualização' }).click()
  await expect(dialog).not.toHaveAttribute('open', '')
  await expect(miniatura).toHaveAttribute('src', capaOriginal)
  await expect.poll(() => miniatura.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
  await expect(miniatura).toBeVisible()
})

test('o carrossel da grade ocupa toda a altura do card sem reservar faixa de miniaturas', async ({ page }) => {
  await abrirPortfolio(page)
  const card = page.locator('.galeria-grade-global .obra.tem-carrossel').first()
  const galeria = card.locator('.obra-galeria')
  const imagem = card.locator('.obra-imagem')
  const [caixaGaleria, caixaImagem] = await Promise.all([
    galeria.boundingBox(),
    imagem.boundingBox(),
  ])
  expect(caixaGaleria).not.toBeNull()
  expect(caixaImagem).not.toBeNull()
  expect(Math.abs(caixaImagem.height - caixaGaleria.height)).toBeLessThanOrEqual(2)
  await expect(card.locator('.carrossel-miniaturas')).toHaveCount(0)
  await expect(card.locator('.carrossel-indice')).toHaveCount(0)
})

test('na lista, as miniaturas ficam sobre a mídia sem reservar altura extra', async ({ page }) => {
  await abrirPortfolio(page)
  await alternarModoGaleria(page, 'Alternar para visualização em lista')
  const card = page.locator('.secao:not(.sobre-secao) .obras-lista .obra.tem-carrossel').first()
  const galeria = card.locator('.obra-galeria')
  const imagem = card.locator('.obra-imagem')
  const miniaturas = card.locator('.carrossel-miniaturas')
  // A lista anima a entrada do card; aguarda a geometria assentar antes de
  // comparar a sobreposição, sem ampliar a tolerância do alinhamento.
  await aguardarQuadroEstavel(galeria)
  const [caixaGaleria, caixaImagem, caixaMiniaturas] = await Promise.all([
    galeria.boundingBox(), imagem.boundingBox(), miniaturas.boundingBox(),
  ])
  expect(caixaGaleria).not.toBeNull()
  expect(caixaImagem).not.toBeNull()
  expect(caixaMiniaturas).not.toBeNull()
  expect(Math.abs(caixaImagem.height - caixaGaleria.height)).toBeLessThanOrEqual(2)
  expect(Math.abs((caixaMiniaturas.y + caixaMiniaturas.height) - (caixaGaleria.y + caixaGaleria.height))).toBeLessThanOrEqual(2)
})

test('o carrossel pausa a troca automática enquanto o ponteiro está sobre o card', async ({ page }) => {
  await page.clock.install()
  await abrirPortfolio(page)
  const card = page.locator('.galeria-grade-global .obra.tem-carrossel').first()
  const imagem = card.locator('.obra-imagem img').first()
  const antes = await imagem.getAttribute('src')
  await card.hover()
  await page.clock.fastForward(9000)
  await expect(imagem).toHaveAttribute('src', antes)
  // React sintetiza onPointerLeave a partir de pointerout; relatedTarget fora do card.
  await card.evaluate(element => element.dispatchEvent(new PointerEvent('pointerout', {
    bubbles: true,
    pointerType: 'mouse',
    relatedTarget: document.body,
  })))
  await page.clock.fastForward(4600)
  await expect.poll(() => imagem.getAttribute('src')).not.toBe(antes)
})

test('o carrossel também pausa durante interação por toque no modo lista', async ({ page }) => {
  await page.clock.install()
  await abrirPortfolio(page)
  await alternarModoGaleria(page, 'Alternar para visualização em lista')
  const card = page.locator('.secao:not(.sobre-secao) .obras-lista .obra.tem-carrossel').first()
  // A lista pode reposicionar o primeiro carrossel fora da viewport.
  // O autoplay só roda depois que o card foi revelado pelo IntersectionObserver.
  await card.scrollIntoViewIfNeeded()
  await expect.poll(() => card.evaluate(element =>
    Number.parseFloat(getComputedStyle(element).opacity)
  ), { timeout: 5000 }).toBeGreaterThanOrEqual(0.95)
  const imagem = card.locator('.obra-imagem img').first()
  const antes = await imagem.getAttribute('src')
  await card.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 1 })
  await page.clock.fastForward(9000)
  await expect(imagem).toHaveAttribute('src', antes)
  await card.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 1 })
  await page.clock.fastForward(4600)
  await expect.poll(() => imagem.getAttribute('src')).not.toBe(antes)
})

test('os títulos da grade só aparecem ao passar o mouse ou focar por teclado', async ({ page }) => {
  await abrirPortfolio(page)
  const card = page.locator('.galeria-grade-global .obra').first()
  const texto = card.locator('.obra-texto')
  const touch = await page.evaluate(() => matchMedia('(hover: none), (pointer: coarse)').matches)
  if (touch) {
    // Sem hover em touch: o título permanece visível como informação essencial.
    await expect(texto).toHaveCSS('opacity', '1')
  } else {
    await expect(texto).toHaveCSS('opacity', '0')
    await card.hover()
    await expect.poll(() => texto.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity))).toBeGreaterThan(.95)
  }
})


test('a grade usa altura explícita e igual para todos os cards, com mídia ocupando a caixa', async ({ page }) => {
  await abrirPortfolio(page, true)
  for (const width of [320, 375, 390, 414, 600, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    const metrics = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.galeria-grade-global .obra')]
      return {
        heights: cards.map(card => Math.round(card.getBoundingClientRect().height)),
        mediaHeights: cards.map(card => Math.round(card.querySelector('.obra-imagem')?.getBoundingClientRect().height || 0)),
      }
    })
    expect(metrics.heights.length).toBe(8)
    expect(new Set(metrics.heights).size, `uniform card height at ${width}px`).toBe(1)
    expect(metrics.heights[0], `non-collapsed card at ${width}px`).toBeGreaterThanOrEqual(230)
    expect(Math.min(...metrics.mediaHeights), `media area at ${width}px`).toBeGreaterThanOrEqual(180)
  }
})


test('as entradas do modo lista acontecem uma vez e respeitam a técnica da obra', async ({ page }) => {
  const dados = [{
    titulo: 'Gravura',
    chave: 'gravura',
    obras: [{ titulo: 'Obra Gravura', imagem: imagemFotoReal, midias: [{ tipo: 'imagem', src: imagemFotoReal }], tipoDeArte: 'gravura' }],
  }]
  await page.route('**/api/portfolio/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categorias: dados,
      referencias: [],
      frames: [],
      redes: [],
      sobre: { nome: 'Luli', frase: 'Arte e experimentação', bio: 'Artista', email: '', instagram: '', formulario: '' },
    }),
  }))
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luli')
  const card = page.locator('.secao:not(.sobre-secao) .obra').first()
  await card.scrollIntoViewIfNeeded()
  await expect.poll(() => card.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity))).toBeGreaterThanOrEqual(.95)
  await expect.poll(() => card.locator('.obra-zoom-trigger img').evaluate(img => getComputedStyle(img).animationName)).toContain('gravuraPrensa')
  await page.evaluate(() => window.scrollTo(0, 0))
  await card.scrollIntoViewIfNeeded()
  await expect(card).toHaveClass(/visivel/)
})


test('o título de Cerâmica anima suavemente apenas após navegação explícita', async ({ page }) => {
  await abrirPortfolio(page)
  await alternarModoGaleria(page, 'Alternar para visualização em lista')

  const cabecalho = page.locator('.secao-cabecalho.arte-ceramica')
  await cabecalho.scrollIntoViewIfNeeded()
  await expect(cabecalho).toHaveClass(/visivel/)
  // A rolagem manual apenas atualiza a seção ativa; não deve disparar a animação de navegação.
  await expect(cabecalho).not.toHaveClass(/animando/)

  const menu = page.locator('.editorial-menu-trigger')
  await menu.click()
  await page.getByRole('dialog', { name: 'Menu do portfólio' })
    .getByRole('button', { name: /cerâmica/i }).click()

  await expect(cabecalho).toHaveClass(/animando/)
  const titulo = cabecalho.locator('h2')
  await expect.poll(() => titulo.evaluate(element =>
    element.getAnimations().filter(animation => animation.animationName === 'tituloCeramica').length
  )).toBe(1)

  // Atualizações de scroll não podem reiniciar nem duplicar a animação.
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')))
  await expect.poll(() => titulo.evaluate(element =>
    element.getAnimations().filter(animation => animation.animationName === 'tituloCeramica').length
  )).toBe(1)
})


test('a navegação editorial desktop apresenta as seções em uma sobreposição', async ({ page }) => {
  await abrirPortfolio(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  const menu = page.locator('.editorial-menu-trigger')
  const overlay = page.getByRole('dialog', { name: 'Menu do portfólio' })
  await expect(menu).toBeVisible()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await expect(overlay).toBeHidden()
  await menu.click()
  await expect(overlay).toBeVisible()
  await expect(overlay.locator('.nav-overlay-link')).toHaveCount(6)
  await overlay.getByRole('button', { name: /cerâmica/i }).click()
  await expect(overlay).toBeHidden()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
})


test('miniaturas não exibem uma linha divisória acima e o rodapé tem fundo sólido e crédito do desenvolvedor', async ({ page }) => {
  await abrirPortfolio(page)
  await alternarModoGaleria(page, 'Alternar para visualização em lista')

  const miniaturas = page.locator('.carrossel-miniaturas').first()
  await expect(miniaturas).toBeVisible()
  await expect.poll(() => miniaturas.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('0px')

  const rodape = page.locator('.rodape')
  await expect(rodape).toBeVisible()
  const estilosRodape = await rodape.evaluate(element => {
    const style = getComputedStyle(element)
    return {
      fundo: style.backgroundColor,
      imagem: style.backgroundImage,
      opacidade: style.opacity,
      posicao: style.position,
      displayShell: getComputedStyle(element.closest('.site-shell')).display,
      direcaoShell: getComputedStyle(element.closest('.site-shell')).flexDirection,
      contato: (() => {
        const link = element.querySelector('.rodape-contato-dev')
        const linkStyle = getComputedStyle(link)
        return {
          borda: linkStyle.borderTopWidth,
          fundo: linkStyle.backgroundColor,
          tamanho: linkStyle.fontSize,
          peso: linkStyle.fontWeight,
        }
      })(),
    }
  })
  expect(estilosRodape.fundo).toBe('rgb(6, 21, 34)')
  expect(estilosRodape.imagem).toBe('none')
  expect(estilosRodape.opacidade).toBe('1')
  expect(estilosRodape.posicao).toBe('relative')
  expect(estilosRodape.displayShell).toBe('flex')
  expect(estilosRodape.direcaoShell).toBe('column')
  // Simula uma página curta: sem conteúdo anterior, o rodapé deve ocupar o fim da janela.
  const alinhamentoRodape = await rodape.evaluate(element => {
    const shell = element.closest('.site-shell')
    Array.from(shell.children).forEach(child => {
      if (child !== element) child.remove()
    })
    const rect = element.getBoundingClientRect()
    return { inferior: rect.bottom, alturaJanela: window.innerHeight }
  })
  expect(alinhamentoRodape.inferior).toBeGreaterThanOrEqual(alinhamentoRodape.alturaJanela - 1)
  expect(estilosRodape.contato.borda).toBe('0px')
  expect(estilosRodape.contato.fundo).toBe('rgba(0, 0, 0, 0)')
  expect(estilosRodape.contato.tamanho).toBe('10.88px')
  expect(estilosRodape.contato.peso).toBe('400')

  await expect(rodape.getByText('Desenvolvido por')).toBeVisible()
  await expect(rodape.getByText('Eduardo Souza', { exact: true })).toBeVisible()
  const contatoDev = rodape.getByRole('link', { name: 'Contato do desenvolvedor' })
  await expect(contatoDev).toHaveAttribute('href', 'mailto:leduardoss19@gmail.com')
  await expect(rodape.getByText('leduardoss19@gmail.com', { exact: true })).toHaveCount(0)
})


test('o tema inicia sempre escuro mesmo se houver uma preferência clara antiga salva', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('portfolio-tema', 'claro'))
  await abrirPortfolio(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'escuro')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
})

test('o seletor de grade/lista fica fora do menu e abaixo do botão voltar ao topo', async ({ page }) => {
  await abrirPortfolio(page)
  await page.evaluate(() => window.scrollTo(0, 900))
  const controles = page.locator('.controles-flutuantes')
  const topo = controles.getByRole('button', { name: 'Voltar ao topo' })
  const modo = controles.getByRole('button', { name: 'Alternar para visualização em lista' })
  await expect(topo).toBeVisible()
  await expect(modo).toBeVisible()
  const [topoBox, modoBox] = await Promise.all([topo.boundingBox(), modo.boundingBox()])
  expect(topoBox).not.toBeNull()
  expect(modoBox).not.toBeNull()
  expect(modoBox.y).toBeGreaterThan(topoBox.y + topoBox.height)

  // O controle flutuante e o menu devem refletir a mesma fonte de estado.
  await modo.click()
  await expect(page.locator('.galeria-grade-global')).toHaveCount(0)
  await expect(page.locator('.secao:not(.sobre-secao) .obra').first()).toBeVisible()
  await expect(controles.getByRole('button', { name: 'Alternar para visualização em grade' })).toBeVisible()

  await page.locator('.editorial-menu-trigger').click()
  const controleMenu = page.locator('.editorial-menu-controls')
    .getByRole('button', { name: 'Alternar para visualização em grade' })
  await expect(controleMenu).toBeVisible()
  await controleMenu.click()
  await expect(page.locator('.galeria-grade-global')).toBeVisible()
  await expect(controles.getByRole('button', { name: 'Alternar para visualização em lista' })).toBeVisible()
})

test('links de referências têm contraste legível no tema claro sem hover', async ({ page }) => {
  await page.route('**/api/portfolio/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categorias: categorias.slice(0, 1),
      referencias: [{ titulo: 'Exposição', periodo: '2025', links: [{ texto: 'Catálogo', url: 'https://example.com' }] }],
      frames: [],
      redes: [],
      sobre: { nome: 'Luli', frase: 'Arte e experimentação', bio: 'Artista', email: '', instagram: '', formulario: '' },
    }),
  }))
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luli')
  await page.locator('.editorial-menu-trigger').click()
  await page.getByRole('button', { name: 'Ativar tema claro' }).click()
  const link = page.getByRole('link', { name: 'Catálogo' })
  await expect(link).toBeVisible()
  const cor = await link.evaluate(element => getComputedStyle(element).color)
  expect(cor).toBe('rgba(23, 43, 59, 0.88)')
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(248, 251, 253)')
})


test('fechar o foco em diferentes pontos do zoom sempre devolve a miniatura ao mesmo retângulo', async ({ page }) => {
  await abrirPortfolio(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const card = page.locator('.galeria-grade-global .obra').first()
  const trigger = card.locator('.obra-zoom-trigger')
  const dialog = page.getByLabel('Visualização ampliada de Ruído cromático')
  const imagem = dialog.locator('.obra-focus-imagem')

  for (const atraso of [90, 260, 430]) {
    await trigger.click()
    await expect(dialog).toHaveAttribute('open', '')
    await page.waitForTimeout(atraso)
    // A abertura centraliza o card antes do foco; a referência correta é
    // a miniatura já centralizada, imediatamente antes de iniciar o retorno.
    await aguardarQuadroEstavel(trigger)
    const antes = await trigger.boundingBox()
    const scrollAntes = await page.evaluate(() => window.scrollY)
    await dialog.getByRole('button', { name: 'Fechar visualização' }).click()
    await expect(dialog).not.toHaveAttribute('open', '')
    await expect.poll(() => imagem.evaluate(element => ({
      transform: getComputedStyle(element).transform,
      clipPath: getComputedStyle(element).clipPath,
      animations: element.getAnimations().length,
    }))).toEqual({ transform: 'none', clipPath: 'none', animations: 0 })
    await aguardarQuadroEstavel(trigger)
    const depois = await trigger.boundingBox()
    const scrollDepois = await page.evaluate(() => window.scrollY)
    expect(depois).not.toBeNull()
    expect(Math.abs(depois.x - antes.x)).toBeLessThanOrEqual(1)
    // O desbloqueio do body no Safari/Chromium pode ajustar a rolagem da janela.
    // Compare a coordenada no documento, não a posição transitória na viewport.
    expect(Math.abs((depois.y + scrollDepois) - (antes.y + scrollAntes))).toBeLessThanOrEqual(1)
    expect(Math.abs(depois.width - antes.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(depois.height - antes.height)).toBeLessThanOrEqual(1)
  }
})


test('o botão flutuante fica mais baixo e mantém margem segura no mobile', async ({ page }) => {
  await abrirPortfolio(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo(0, 900))
  const botao = page.locator('.alternar-modo-flutuante')
  await expect(botao).toBeVisible()
  const botaoBox = await botao.boundingBox()
  expect(botaoBox).not.toBeNull()
  const distanciaDaBordaInferior = 844 - (botaoBox.y + botaoBox.height)
  expect(distanciaDaBordaInferior).toBeGreaterThanOrEqual(8)
  expect(distanciaDaBordaInferior).toBeLessThanOrEqual(22)
})

test('o botão flutuante fica próximo à borda inferior no desktop', async ({ page }) => {
  await abrirPortfolio(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => window.scrollTo(0, 900))
  const botao = page.locator('.alternar-modo-flutuante')
  await expect(botao).toBeVisible()
  const botaoBox = await botao.boundingBox()
  expect(botaoBox).not.toBeNull()
  const distanciaDaBordaInferior = 900 - (botaoBox.y + botaoBox.height)
  expect(distanciaDaBordaInferior).toBeGreaterThanOrEqual(2)
  expect(distanciaDaBordaInferior).toBeLessThanOrEqual(8)
})

test('rodapé acompanha o tema claro com fundo e textos legíveis', async ({ page }) => {
  await abrirPortfolio(page)
  await page.locator('.editorial-menu-trigger').click()
  await page.getByRole('button', { name: 'Ativar tema claro' }).click()
  const rodape = page.locator('.rodape')
  await expect(rodape).toBeVisible()
  await expect(rodape).toHaveCSS('background-color', 'rgb(245, 242, 235)')
  await expect(rodape).toHaveCSS('color', 'rgb(36, 35, 31)')
  const contrasteTextoSecundario = await rodape.locator('small').evaluate(element => {
    const rgb = value => value.match(/[0-9.]+/g).slice(0, 3).map(Number).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    const luminance = value => { const channels = rgb(value); return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 }
    const values = [luminance(getComputedStyle(element).color), luminance(getComputedStyle(element.closest('.rodape')).backgroundColor)].sort((a, b) => b - a)
    return (values[0] + .05) / (values[1] + .05)
  })
  expect(contrasteTextoSecundario).toBeGreaterThanOrEqual(4.5)
  await expect(rodape.locator('.rodape-creditos strong')).toHaveCSS('color', 'rgb(36, 35, 31)')
})


test('fotografia permanece totalmente renderizada após ciclos repetidos de abrir e fechar o foco no mobile', async ({ page }) => {
  const categoriasFotografia = [{
    titulo: 'Fotografia',
    chave: 'fotografia',
    obras: [{
      titulo: 'Luz persistente',
      imagem: imagemFotoReal,
      tipoDeArte: 'fotografia',
      midias: [{ tipo: 'imagem', src: imagemFotoReal }, { tipo: 'imagem', src: imagemTesteAlternativa }],
    }],
  }]
  await page.route('**/api/portfolio/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categorias: categoriasFotografia,
      referencias: [],
      frames: [],
      redes: [],
      sobre: { nome: 'Luli', frase: 'Arte e experimentação', bio: 'Artista', email: '', instagram: '', formulario: '' },
    }),
  }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luli')
  await page.locator('.editorial-menu-trigger').click()
  await alternarModoGaleria(page, 'Alternar para visualização em grade')

  const card = page.locator('.galeria-grade-global .obra.categoria-fotografia').first()
  await card.scrollIntoViewIfNeeded()
  const trigger = card.locator('.obra-zoom-trigger')
  const miniatura = trigger.locator('img')
  await expect.poll(() => miniatura.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
  await expect.poll(() => miniatura.evaluate(img =>
    img.getAnimations().every(animation => animation.playState === 'finished')
  ), { timeout: 5000 }).toBe(true)

  const dialog = page.getByLabel('Visualização ampliada de Luz persistente')
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    await trigger.click()
    await expect(dialog).toHaveAttribute('open', '')
    await expect.poll(() => dialog.locator('.obra-focus-imagem').evaluate(img =>
      img.complete && img.naturalWidth > 0
    )).toBe(true)
    await dialog.getByRole('button', { name: 'Fechar visualização' }).click()
    await expect(dialog).not.toHaveAttribute('open', '')
    await expect(trigger).toBeVisible()
    await expect.poll(() => miniatura.evaluate(img => {
      const style = getComputedStyle(img)
      const rect = img.getBoundingClientRect()
      return {
        carregada: img.complete && img.naturalWidth > 0,
        opacidade: style.opacity,
        visibilidade: style.visibility,
        recorte: style.clipPath,
        largura: rect.width,
        altura: rect.height,
      }
    })).toEqual({
      carregada: true,
      opacidade: '1',
      visibilidade: 'visible',
      recorte: 'inset(0px)',
      largura: expect.any(Number),
      altura: expect.any(Number),
    })
    const caixa = await miniatura.boundingBox()
    expect(caixa?.width || 0).toBeGreaterThan(100)
    expect(caixa?.height || 0).toBeGreaterThan(100)
  }
})
