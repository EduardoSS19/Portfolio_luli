import { test, expect } from '@playwright/test'

const image = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 100%22%3E%3Crect width=%2280%22 height=%22100%22 fill=%22%231e6688%22/%3E%3C/svg%3E'

async function openLiveLayoutPreview(page) {
  await page.addInitScript(() => {
    window.addEventListener('message', event => {
      if (event.data?.type === 'cms-layout-preview:ready') window.__cmsPreviewReady = true
    })
  })
  await page.route('**/api/portfolio/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categorias: [{ titulo: 'Pintura', chave: 'pintura', obras: [
        { titulo: 'Obra de teste', imagem: image, descricao: 'Estudo de contraste.' },
      ] }],
      referencias: [{ titulo: 'Exposição coletiva', periodo: '2025', links: [{ texto: 'Instituição', url: 'https://example.com' }] }], frames: [], redes: [],
      sobre: { nome: 'Luli', frase: 'Arte e experimentação', bio: 'Artista', email: 'contato@artista-demo.example', instagram: '', formulario: '' },
      layout: { default_gallery_view: 'lista', default_theme: 'escuro' },
    }),
  }))
  await page.goto('/?layout_preview=1', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.site-shell')).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean(window.__cmsPreviewReady))).toBe(true)
}

async function sendSettings(page, settings, focus = 'page', previewMode, animatePreview = false) {
  await page.evaluate(({ settings, focus, previewMode, animatePreview }) => {
    window.postMessage({ type: 'cms-layout-preview:update', settings, focus, previewMode, animatePreview }, window.location.origin)
  }, { settings, focus, previewMode, animatePreview })
}

test('a prévia navega até a seção editada dentro do iframe', async ({ page }) => {
  await openLiveLayoutPreview(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  const initialScrollY = await page.evaluate(() => window.scrollY)

  await sendSettings(page, { show_references: true }, 'references', undefined, true)
  await expect(page.locator('#Referências')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(initialScrollY)

  await page.evaluate(() => window.scrollTo(0, 0))
  await sendSettings(page, { show_bio: true }, 'bio', undefined, true)
  await expect(page.locator('.sobre-secao')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(initialScrollY)
})

test('modelos alteram a apresentação e a navegação sem recarregar a prévia', async ({ page }) => {
  await openLiveLayoutPreview(page)
  await sendSettings(page, { presentation_mode: 'carousel', navigation_mode: 'dropdown' }, 'page')
  await expect(page.locator('.site-shell')).toHaveAttribute('data-layout-presentation', 'carousel')
  await expect(page.locator('.site-shell')).toHaveAttribute('data-layout-navigation', 'dropdown')
  await expect(page.locator('.site-nav')).toHaveClass(/navigation-dropdown/)
  const carousel = await page.locator('.secao:not(.sobre-secao) .obras-lista').first().evaluate(element => ({
    display: getComputedStyle(element).display,
    overflowX: getComputedStyle(element).overflowX,
    snap: getComputedStyle(element).scrollSnapType,
  }))
  expect(carousel.display).toBe('flex')
  expect(['auto', 'scroll']).toContain(carousel.overflowX)
  expect(carousel.snap).toContain('x')

  await sendSettings(page, { presentation_mode: 'immersive', navigation_mode: 'sidebar' }, 'page')
  await expect(page.locator('.site-shell')).toHaveAttribute('data-layout-presentation', 'immersive')
  await expect(page.locator('.site-nav')).toHaveClass(/navigation-sidebar/)
  await sendSettings(page, { presentation_mode: 'masonry', navigation_mode: 'curtain' }, 'page')
  await expect(page.locator('.site-shell')).toHaveAttribute('data-layout-presentation', 'masonry')
  await expect(page.locator('.site-nav')).toHaveClass(/navigation-curtain/)
})

test('preview muda automaticamente entre grade e lista sem recarregar o iframe', async ({ page }) => {
  await openLiveLayoutPreview(page)
  const initialNavigation = await page.evaluate(() => performance.getEntriesByType('navigation')[0].type)

  await sendSettings(page, { default_gallery_view: 'lista', gallery_columns: '4' }, 'gallery', 'grade')
  await expect(page.locator('.galeria-grade-global')).toBeVisible()
  await expect(page.locator('.galeria-grade-global .obra.modo-grade')).toHaveCount(6)
  await expect(page.locator('.site-shell')).toHaveAttribute('data-layout-gallery-columns', '4')

  await sendSettings(page, { default_gallery_view: 'lista', gallery_columns: '2' }, 'gallery', 'lista')
  await expect(page.locator('.galeria-grade-global')).toHaveCount(0)
  await expect(page.locator('.secao:not(.sobre-secao) .obra')).toHaveCount(6)
  await expect(page.locator('.site-shell')).toHaveAttribute('data-layout-gallery-columns', '2')
  expect(await page.evaluate(() => performance.getEntriesByType('navigation')[0].type)).toBe(initialNavigation)
})

test('texto, legendas, cartões e destaques recebem cores com contraste AA', async ({ page }) => {
  await openLiveLayoutPreview(page)
  await sendSettings(page, {
    default_gallery_view: 'grade',
    dark_color_background: '#777777',
    dark_color_surface: '#888888',
    dark_color_text: '#808080',
    dark_color_muted: '#858585',
    dark_color_accent: '#777777',
  }, 'page')
  await expect(page.locator('.galeria-grade-global .obra-texto h3').first()).toBeVisible()

  const ratios = await page.locator('.site-shell').evaluate(shell => {
    const luminance = hex => {
      const rgb = hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255)
      const linear = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722
    }
    const contrast = (a, b) => {
      const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (values[0] + .05) / (values[1] + .05)
    }
    const style = getComputedStyle(shell)
    const color = name => style.getPropertyValue(name).trim()
    return [
      contrast(color('--texto'), color('--azul-escuro')),
      contrast(color('--layout-surface-text'), color('--azul-medio')),
      contrast(color('--layout-muted'), color('--azul-escuro')),
      contrast(color('--layout-surface-muted'), color('--azul-medio')),
      contrast(color('--azul-claro'), color('--azul-escuro')),
      contrast(color('--layout-accent-on-surface'), color('--azul-medio')),
      contrast(color('--layout-nav-muted'), color('--azul-medio')),
      contrast(color('--layout-accent-on-overlay'), '#051421'),
    ]
  })
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5)
  await expect(page.locator('.galeria-grade-global .obra-texto h3').first()).toHaveCSS('color', 'rgb(255, 255, 255)')

  await sendSettings(page, {
    default_gallery_view: 'lista',
    dark_color_background: '#777777',
    dark_color_surface: '#888888',
    dark_color_text: '#888888',
    dark_color_muted: '#888888',
    dark_color_accent: '#888888',
  }, 'gallery', 'lista')
  const listTextContrast = await page.locator('.secao:not(.sobre-secao) .obra:not(.modo-grade)').first().evaluate(card => {
    const parse = value => value.match(/[0-9.]+/g).slice(0,3).map(Number)
    const luminance = rgb => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum,value,index) => sum + value * [.2126,.7152,.0722][index],0)
    const ratio = (foreground,background) => {
      const values = [luminance(parse(foreground)),luminance(parse(background))].sort((a,b)=>b-a)
      return (values[0]+.05)/(values[1]+.05)
    }
    const panel = getComputedStyle(card.querySelector('.obra-texto')).backgroundColor
    return ['h3','.obra-texto > p','.categoria-legenda'].map(selector => {
      const element = card.querySelector(selector)
      return { selector, ratio:ratio(getComputedStyle(element).color,panel) }
    })
  })
  for (const item of listTextContrast) expect(item.ratio, item.selector).toBeGreaterThanOrEqual(4.5)

  await sendSettings(page, {
    default_theme: 'claro',
    light_color_background: '#eeeeee',
    light_color_surface: '#ffffff',
    light_color_text: '#eeeeee',
    light_color_muted: '#eeeeee',
    light_color_accent: '#eeeeee',
  }, 'page')
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe('claro')
  const lightRatios = await page.locator('.site-shell').evaluate(shell => {
    const luminance = hex => {
      const rgb = hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255)
      const linear = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722
    }
    const contrast = (a, b) => {
      const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (values[0] + .05) / (values[1] + .05)
    }
    const style = getComputedStyle(shell)
    const color = name => style.getPropertyValue(name).trim()
    return [
      contrast(color('--texto'), color('--azul-escuro')),
      contrast(color('--layout-surface-text'), color('--azul-medio')),
      contrast(color('--layout-muted'), color('--azul-escuro')),
      contrast(color('--layout-surface-muted'), color('--azul-medio')),
      contrast(color('--azul-claro'), color('--azul-escuro')),
      contrast(color('--layout-accent-on-surface'), color('--azul-medio')),
      contrast(color('--layout-nav-muted'), color('--azul-medio')),
      contrast(color('--layout-accent-on-overlay'), '#051421'),
    ]
  })
  for (const ratio of lightRatios) expect(ratio).toBeGreaterThanOrEqual(4.5)
})


test('prévia respeita opções independentes da apresentação e referências', async ({ page }) => {
  await openLiveLayoutPreview(page)
  await expect(page.locator('.sobre-secao .obra-imagem')).toBeVisible()
  await expect(page.locator('.sobre-secao .biografia')).toBeVisible()
  await expect(page.locator('#Referências')).toBeVisible()
  await expect(page.locator('.nav-overlay-link', { hasText: 'Referências' })).toHaveCount(1)
  await sendSettings(page, { show_bio_image: false, show_bio: true, show_references: false }, 'page')
  await expect(page.locator('.sobre-secao .obra-imagem')).toHaveCount(0)
  await expect(page.locator('.sobre-secao .biografia')).toBeVisible()
  await expect(page.locator('#Referências')).toHaveCount(1)
  await expect(page.locator('#Referências')).toBeHidden()
  await expect(page.locator('.nav-overlay-link', { hasText: 'Referências' })).toHaveCount(0)
  await sendSettings(page, { show_bio_image: true, show_bio: false, show_references: true }, 'page')
  await expect(page.locator('.sobre-secao .obra-imagem')).toBeVisible()
  await expect(page.locator('.sobre-secao .biografia')).toHaveCount(0)
  await expect(page.locator('.sobre-secao .categoria-legenda')).toHaveCount(0)
  await expect(page.locator('.nav-overlay-link', { hasText: 'Início' })).toHaveCount(0)
  await expect(page.locator('#Referências')).toBeVisible()
})

test('configurações de visibilidade são preservadas ao alternar entre temas', async ({ page }) => {
  await openLiveLayoutPreview(page)
  await sendSettings(page, { show_bio_image: false, show_bio: false, show_references: false, default_theme: 'claro' }, 'page')
  await expect(page.locator('.sobre-secao')).toHaveCount(0)
  await expect(page.locator('.nav-overlay-link', { hasText: 'Início' })).toHaveCount(0)
  await expect(page.locator('#Referências')).toHaveCount(1)
  await expect(page.locator('#Referências')).toBeHidden()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'claro')
})


test('prévia de layout apresenta conteúdo demonstrativo em todas as seções', async ({ page }) => {
  await openLiveLayoutPreview(page)
  await expect(page.locator('.hero')).toBeVisible()
  await expect(page.locator('.sobre-secao')).toBeVisible()
  await expect(page.locator('.sobre-secao .biografia')).toContainText('Artista visual que pesquisa as relações entre matéria, memória e paisagem.')
  await expect(page.locator('.secao:not(.sobre-secao):not(.secao-contato)')).toHaveCount(4)
  await expect(page.locator('.secao:not(.sobre-secao):not(.secao-contato) .obra')).toHaveCount(6)
  await expect(page.locator('#Referências')).toBeVisible()
  await expect(page.locator('#Referências')).toContainText('Exposição coletiva')
  await expect(page.locator('#Contato')).toBeVisible()
  const contactForm = page.locator('#Contato .form-contato')
  await expect(contactForm).toBeVisible()
  await expect(contactForm.getByLabel('Nome')).toBeVisible()
  await expect(contactForm.getByLabel('E-mail')).toBeVisible()
  await expect(contactForm.getByLabel('Mensagem')).toBeVisible()
})

test('seções centrais podem ser removidas do modelo sem deixar links órfãos', async ({ page }) => {
  await openLiveLayoutPreview(page)
  await sendSettings(page, { show_bio:false, show_bio_image:false, show_references:false, show_contact:false }, 'page')
  await expect(page.locator('.sobre-secao')).toHaveCount(0)
  await expect(page.locator('#Referências')).toHaveCount(1)
  await expect(page.locator('#Referências')).toBeHidden()
  await expect(page.locator('#Contato')).toHaveCount(0)
  await expect(page.locator('.nav-overlay-link', { hasText:'Início' })).toHaveCount(0)
  await expect(page.locator('.nav-overlay-link', { hasText:'Referências' })).toHaveCount(0)
  await expect(page.locator('.nav-overlay-link', { hasText:'Contato' })).toHaveCount(0)
})

test('modelos preenchem todas as seções preparadas com exemplos adequados ao tipo', async ({ page }) => {
  await openLiveLayoutPreview(page)
  const types = ['exhibitions','process','services','press','testimonials','tattoo-flash','tattoo-booking','healed-work','guest-spots','studio-team']
  await sendSettings(page, {
    custom_sections: types.map((type,index) => ({
      id: 'demo-'+type,
      type,
      title: ({
        exhibitions:'Exposições e trajetória', process:'Processo criativo', services:'Serviços e encomendas',
        press:'Imprensa e publicações', testimonials:'Depoimentos', 'tattoo-flash':'Flash disponíveis',
        'tattoo-booking':'Agendamento de tatuagem', 'healed-work':'Trabalhos cicatrizados',
        'guest-spots':'Agenda e guest spots', 'studio-team':'Estúdio e equipe',
      })[type],
      intro:'Conteúdo demonstrativo para visualizar este modelo.',
      items:[],
    })),
  }, 'page')
  await expect(page.locator('[data-preview-example="true"]')).toHaveCount(types.length)
  await expect(page.locator('.portfolio-custom-empty-preview')).toHaveCount(0)
  await expect(page.locator('.portfolio-custom-card h3')).toHaveCount(20)
  await expect(page.locator('.section-tattoo-flash .portfolio-custom-card')).toContainText('Flash disponível')
  await expect(page.locator('.section-tattoo-booking .portfolio-custom-card')).toContainText('orçamento')
  await expect(page.locator('.section-healed-work .portfolio-custom-card')).toContainText('cicatrizada')
  await expect(page.locator('.section-studio-team .portfolio-custom-card')).toContainText('Artista residente')
})

test('prévia mantém a posição de rolagem ao alterar opções de layout', async ({ page }) => {
  await openLiveLayoutPreview(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  const initialScrollY = await page.evaluate(() => window.scrollY)

  await sendSettings(page, { show_references: true }, 'references')
  await expect(page.locator('#Referências')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initialScrollY)

  await sendSettings(page, { dark_color_accent: '#88aacc' }, 'page')
  await expect(page.locator('#Referências')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initialScrollY)

  await sendSettings(page, { show_references: true }, 'contact')
  await expect(page.locator('#Contato')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initialScrollY)
})

test('prévia fixa reduz a largura do viewport lógico e mantém rolagem vertical', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.route('**/api/cms/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/api/cms/layout/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        settings: {}, permissions: { canView: true, canChange: true },
      }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  })
  await page.route('**/api/portfolio/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ categorias: [], referencias: [], frames: [], redes: [], sobre: { nome: 'Luli', email: 'contato@artista-demo.example' }, layout: {} }),
  }))

  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await page.locator('.cms-nav').getByRole('button', { name: /Layout/ }).click()
  const preview = page.locator('.cms-layout-inline-preview')
  await expect(preview).toBeVisible()
  // Mantém a área de teste dentro do viewport de cada projeto (desktop e iPhone),
  // mas limita a largura para exercitar a redução do viewport lógico nos dois.
  await preview.evaluate(element => {
    element.style.width = 'min(700px, calc(100vw - 32px))'
    element.style.maxWidth = 'min(700px, calc(100vw - 32px))'
  })
  const viewport = preview.locator('.cms-layout-preview-frame-inline')
  const iframe = preview.locator('iframe')
  await expect(iframe).toBeVisible()
  await expect.poll(() => viewport.evaluate(element => {
    const expectedScale = Math.min(1, element.clientWidth / 1440)
    return Math.abs(Number(element.dataset.previewScale) - expectedScale)
  })).toBeLessThanOrEqual(0.002)

  const geometry = await preview.evaluate(root => {
    const frame = root.querySelector('.cms-layout-preview-frame-inline')
    const stage = root.querySelector('.cms-layout-preview-stage-inline')
    const iframe = root.querySelector('iframe')
    return {
      availableWidth: frame.clientWidth,
      stageWidth: stage.getBoundingClientRect().width,
      iframeWidth: iframe.getBoundingClientRect().width,
      iframeLayoutWidth: iframe.clientWidth,
      overflowY: getComputedStyle(frame).overflowY,
    }
  })
  expect(Math.abs(geometry.stageWidth - geometry.availableWidth)).toBeLessThanOrEqual(3)
  expect(geometry.iframeLayoutWidth).toBe(1440)
  expect(geometry.overflowY).toBe('auto')
})
