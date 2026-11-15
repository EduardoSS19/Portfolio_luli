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

test('preview inicial é um portfólio completo com perfil, imagens, obras, trajetória e redes', async ({ page }) => {
  await openLiveLayoutPreview(page)
  await expect(page.locator('.hero h1')).toHaveText('Helena Duarte')
  await expect(page.locator('.hero p')).toContainText('Artes visuais')
  await expect(page.locator('.sobre-secao img')).toHaveAttribute('src', /images\.unsplash\.com/)
  await expect(page.locator('.sobre-secao .biografia')).toContainText('Artista visual e pesquisadora independente')
  await expect(page.locator('.obras-lista .obra')).toHaveCount(8)
  await expect(page.locator('.obra img').first()).toHaveAttribute('src', /images\.unsplash\.com/)
  await expect(page.locator('#Referências .referencia-item')).toHaveCount(3)
  await expect(page.locator('.rodape-links a')).toHaveCount(4)
  await expect(page.locator('#Contato form')).toBeVisible()
})

test('formulário do preview simula envio sem chamar nenhum serviço externo', async ({ page }) => {
  let contactRequests = 0
  await page.route('**/api/contact/**', route => {
    contactRequests += 1
    return route.fulfill({ status: 500, body: 'Preview must not send' })
  })
  await openLiveLayoutPreview(page)
  await page.locator('#Contato input[name="nome"]').fill('Pessoa visitante')
  await page.locator('#Contato input[name="email"]').fill('visitante@example.com')
  await page.locator('#Contato textarea[name="mensagem"]').fill('Gostaria de saber mais sobre este trabalho.')
  await page.locator('#Contato button[type="submit"]').click()
  await expect(page.locator('#Contato .form-status')).toContainText('nenhuma mensagem foi enviada')
  expect(contactRequests).toBe(0)
})

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
  const menuTrigger = page.locator('.editorial-menu-trigger')
  const menuBackdrop = page.locator('.editorial-menu-backdrop')
  await menuTrigger.click()
  await expect(menuBackdrop).toHaveAttribute('aria-hidden', 'false')
  await page.locator('.nav-overlay-link').first().click()
  await expect(menuBackdrop).toHaveAttribute('aria-hidden', 'true')
  const carousel = await page.locator('.secao:not(.sobre-secao) .obras-lista').first().evaluate(element => ({
    display: getComputedStyle(element).display,
    overflowX: getComputedStyle(element).overflowX,
    snap: getComputedStyle(element).scrollSnapType,
  }))
  expect(carousel.display).toBe('flex')
  expect(['auto', 'scroll']).toContain(carousel.overflowX)
  expect(carousel.snap).toContain('x')

  await sendSettings(page, { presentation_mode: 'immersive', navigation_mode: 'sidebar' }, 'navigation')
  await expect(page.locator('.site-shell')).toHaveAttribute('data-layout-presentation', 'immersive')
  await expect(page.locator('.site-nav')).toHaveClass(/navigation-sidebar/)
  await expect(menuBackdrop).toHaveAttribute('aria-hidden', 'true')
  await menuTrigger.click()
  await expect(menuBackdrop).toHaveAttribute('aria-hidden', 'false')
  await menuTrigger.click()
  await expect(menuBackdrop).toHaveAttribute('aria-hidden', 'true')
  await menuTrigger.click()
  await expect(menuBackdrop).toHaveAttribute('aria-hidden', 'false')
  await page.locator('.nav-overlay-link').first().click()
  await expect(menuBackdrop).toHaveAttribute('aria-hidden', 'true')
  await sendSettings(page, { presentation_mode: 'masonry', navigation_mode: 'curtain' }, 'navigation')
  await expect(page.locator('.site-shell')).toHaveAttribute('data-layout-presentation', 'masonry')
  await expect(page.locator('.site-nav')).toHaveClass(/navigation-curtain/)
  await expect(menuBackdrop).toHaveAttribute('aria-hidden', 'true')
  await menuTrigger.click()
  await expect(menuBackdrop).toHaveAttribute('aria-hidden', 'false')
  await page.locator('.nav-overlay-link').first().click()
  await expect(menuBackdrop).toHaveAttribute('aria-hidden', 'true')
})

test('menu navega até seções personalizadas tanto na grade quanto na lista', async ({ page }) => {
  await openLiveLayoutPreview(page)
  await sendSettings(page, {
    default_gallery_view: 'grade',
    custom_sections: [{
      id: 'custom-processo',
      type: 'process',
      title: 'Processo criativo',
      intro: 'Etapas e experimentações do trabalho.',
      items: [],
    }],
  }, 'page', 'grade')

  const customSection = page.locator('#custom-processo')
  await expect(customSection).toBeVisible()
  const initialScroll = await page.evaluate(() => window.scrollY)
  await page.locator('.editorial-menu-trigger').click()
  const customLink = page.locator('.nav-overlay-link').filter({ hasText: 'Processo criativo' })
  await expect(customLink).toHaveCount(1)
  await customLink.click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(initialScroll)
  await expect(customSection).toBeInViewport()
})

test('preview muda automaticamente entre grade e lista sem recarregar o iframe', async ({ page }) => {
  await openLiveLayoutPreview(page)
  const initialNavigation = await page.evaluate(() => performance.getEntriesByType('navigation')[0].type)

  await sendSettings(page, { default_gallery_view: 'lista', gallery_columns: '4' }, 'gallery', 'grade')
  await expect(page.locator('.galeria-grade-global')).toBeVisible()
  await expect(page.locator('.galeria-grade-global .obra.modo-grade')).toHaveCount(8)
  await expect(page.locator('.site-shell')).toHaveAttribute('data-layout-gallery-columns', '4')

  await sendSettings(page, { default_gallery_view: 'lista', gallery_columns: '2' }, 'gallery', 'lista')
  await expect(page.locator('.galeria-grade-global')).toHaveCount(0)
  await expect(page.locator('.secao:not(.sobre-secao) .obra')).toHaveCount(8)
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
  await expect(page.locator('.nav-overlay-link', { hasText: 'Início' })).toHaveCount(1)
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
  await expect(page.locator('.sobre-secao .biografia')).toContainText('Artista visual e pesquisadora independente')
  await expect(page.locator('.secao:not(.sobre-secao):not(.secao-contato)')).toHaveCount(4)
  await expect(page.locator('.secao:not(.sobre-secao):not(.secao-contato) .obra')).toHaveCount(8)
  await expect(page.locator('#Referências')).toBeVisible()
  await expect(page.locator('#Referências')).toContainText('Exposição individual')
  await expect(page.locator('#Contato')).toBeVisible()
  const contactForm = page.locator('#Contato .form-contato')
  await expect(contactForm).toBeVisible()
  await expect(contactForm.getByLabel('Nome')).toBeVisible()
  await expect(contactForm.getByLabel('E-mail')).toBeVisible()
  await expect(contactForm.getByLabel('Mensagem')).toBeVisible()
})

test('cada família de modelo recebe conteúdo demonstrativo da sua área', async ({ page }) => {
  await openLiveLayoutPreview(page)
  await sendSettings(page, {
    presentation_mode:'carousel',
    navigation_mode:'dropdown',
    default_theme:'escuro',
    custom_sections:[{id:'preset-tattoo-flash',type:'tattoo-flash',title:'Flash disponíveis',intro:'Exemplos',items:[]}],
  }, 'page')
  await expect(page.locator('.hero')).toContainText('Maya Reis')
  await expect(page.locator('.secao:not(.sobre-secao) h2').first()).toContainText('Tatuagens autorais')
  await page.locator('.editorial-menu-trigger').click()
  await expect(page.locator('.nav-overlay-link', { hasText:'Flash disponíveis' })).toHaveCount(1)
  await expect(page.locator('.editorial-menu-footer')).toContainText('Maya Reis')
  await page.keyboard.press('Escape')

  await sendSettings(page, {
    presentation_mode:'immersive',
    navigation_mode:'sidebar',
    custom_sections:[{id:'preset-photo-exhibitions',type:'exhibitions',title:'Exposições',intro:'Exemplos',items:[]}],
  }, 'page')
  await expect(page.locator('.hero')).toContainText('Clara Nogueira')
  await expect(page.locator('.secao:not(.sobre-secao) h2').first()).toContainText('Ensaios autorais')

  await sendSettings(page, {
    presentation_mode:'carousel',
    navigation_mode:'dropdown',
    default_theme:'claro',
    custom_sections:[{id:'preset-design-services',type:'services',title:'Serviços',intro:'Exemplos',items:[]}],
  }, 'page')
  await expect(page.locator('.hero')).toContainText('Estúdio Norte')
  await expect(page.locator('.secao:not(.sobre-secao) h2').first()).toContainText('Identidade e branding')

  await sendSettings(page, {
    presentation_mode:'masonry',
    navigation_mode:'dropdown',
    default_theme:'claro',
    custom_sections:[{id:'preset-illustration-process',type:'process',title:'Processo',intro:'Exemplos',items:[]}],
  }, 'page')
  await expect(page.locator('.hero')).toContainText('Bia Campos')
  await expect(page.locator('.secao:not(.sobre-secao) h2').first()).toContainText('Ilustração editorial')
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
  await expect(page.locator('.portfolio-custom-card h3')).toHaveCount(22)
  await expect(page.locator('.section-tattoo-flash')).toContainText('Flash disponíveis')
  await expect(page.locator('.section-tattoo-booking')).toContainText('orçamento')
  await expect(page.locator('.section-healed-work')).toContainText('cicatrizada')
  await expect(page.locator('.section-studio-team')).toContainText('Artista residente')
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
      availableHeight: frame.clientHeight,
      stageWidth: stage.getBoundingClientRect().width,
      stageHeight: stage.getBoundingClientRect().height,
      iframeWidth: iframe.getBoundingClientRect().width,
      iframeLayoutWidth: iframe.clientWidth,
      iframeLayoutHeight: iframe.clientHeight,
      overflowY: getComputedStyle(frame).overflowY,
    }
  })
  expect(Math.abs(geometry.stageWidth - geometry.availableWidth)).toBeLessThanOrEqual(3)
  expect(geometry.iframeLayoutWidth).toBe(1440)
  expect(geometry.iframeLayoutHeight).toBe(900)
  expect(Math.abs(geometry.stageHeight - 900 * geometry.availableWidth / 1440)).toBeLessThanOrEqual(3)
  expect(geometry.overflowY).toBe('hidden')

  await preview.scrollIntoViewIfNeeded()
  const previewFrame = page.frameLocator('.cms-layout-inline-preview iframe')
  await previewFrame.locator('.editorial-menu-trigger').click()
  await expect(previewFrame.locator('.site-nav')).toHaveClass(/menu-aberto/)
  const menuGeometry = await preview.locator('iframe').evaluate(iframe => {
    const menu = iframe.contentDocument.querySelector('.editorial-menu-backdrop')
    return { menuHeight: menu.getBoundingClientRect().height, viewportHeight: iframe.contentWindow.innerHeight, documentHeight: iframe.contentDocument.documentElement.scrollHeight }
  })
  expect(Math.abs(menuGeometry.menuHeight - menuGeometry.viewportHeight)).toBeLessThanOrEqual(2)
  expect(menuGeometry.documentHeight).toBeGreaterThan(menuGeometry.viewportHeight)
  await previewFrame.locator('.editorial-menu-trigger').press('Escape')
  await expect(previewFrame.locator('.site-nav')).not.toHaveClass(/menu-aberto/)
  await preview.locator('iframe').evaluate(iframe => iframe.contentWindow.scrollTo(0, 360))
  await expect.poll(() => preview.locator('iframe').evaluate(iframe => iframe.contentWindow.scrollY)).toBeGreaterThan(0)
})

test('menu lateral permanece fechado na prévia até o visitante clicar para abrir', async ({ page }) => {
  await openLiveLayoutPreview(page)
  await sendSettings(page, { navigation_mode: 'sidebar' }, 'navigation')
  const nav = page.locator('.site-nav')
  await expect(nav).toHaveClass(/navigation-sidebar/)
  await expect(nav).not.toHaveClass(/menu-aberto/)
  await expect(nav.locator('.editorial-menu-trigger')).toHaveAttribute('aria-expanded', 'false')
  await nav.locator('.editorial-menu-trigger').click()
  await expect(nav).toHaveClass(/menu-aberto/)
})

test('biblioteca de seções mantém os submenus recolhidos e oferece campos e design específicos', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 })
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
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ categorias: [], referencias: [], frames: [], redes: [], sobre: { nome: 'Luli' }, layout: {} }),
  }))
  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await page.locator('.cms-nav').getByRole('button', { name: /Layout/ }).click()
  const library = page.locator('.cms-layout-section-library')
  const addMenu = library.locator('.cms-layout-library-add')
  await expect(addMenu).not.toHaveAttribute('open', '')
  await addMenu.locator('summary').click()
  await library.getByRole('button', { name: /Flash tattoo/ }).click()
  const section = library.locator('.cms-layout-custom-section').last()
  const menus = section.locator('details.cms-layout-custom-section-editor')
  await expect(menus).toHaveCount(2)
  await expect(menus.nth(0)).not.toHaveAttribute('open', '')
  await expect(menus.nth(1)).not.toHaveAttribute('open', '')
  await menus.nth(1).locator('summary').click()
  await expect(menus.nth(1).getByLabel('Estilo de apresentação')).toHaveValue('flash-grid')
  await menus.nth(0).locator('summary').click()
  await section.getByRole('button', { name: '+ Adicionar flash' }).click()
  await section.locator('.cms-layout-custom-item summary').click()
  await expect(section.locator('.cms-layout-custom-item').getByPlaceholder('Ex.: Disponível · Peça única')).toBeVisible()
})

test('modal de hover representa o viewport desktop e mantém interação', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 })
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
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ categorias: [], referencias: [], frames: [], redes: [], sobre: { nome: 'Luli' }, layout: {} }),
  }))
  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await page.locator('.cms-nav').getByRole('button', { name: /Layout/ }).click()
  const composition = page.locator('.cms-layout-field-group').first()
  await composition.locator('summary').click()
  await composition.locator('.cms-layout-option').first().hover()
  const modal = page.locator('.cms-layout-hover-preview-floating')
  await expect(modal).toBeVisible()
  const behavior = await modal.locator('iframe').evaluate(frame => ({
    pointerEvents: getComputedStyle(frame).pointerEvents,
    transform: getComputedStyle(frame).transform,
    scrolling: frame.getAttribute('scrolling'),
    logicalWidth: frame.contentWindow.innerWidth,
    logicalHeight: frame.contentWindow.innerHeight,
    renderedWidth: frame.getBoundingClientRect().width,
    stageWidth: frame.parentElement.getBoundingClientRect().width,
    modalWidth: frame.closest('.cms-layout-hover-preview-floating').getBoundingClientRect().width,
    device: frame.closest('.cms-layout-hover-preview-floating').dataset.device,
  }))
  expect(behavior.pointerEvents).toBe('auto')
  expect(behavior.transform).not.toBe('none')
  expect(behavior.logicalWidth).toBe(1440)
  expect(behavior.logicalHeight).toBe(900)
  expect(behavior.renderedWidth).toBeGreaterThan(600)
  expect(behavior.stageWidth).toBeGreaterThan(600)
  expect(behavior.modalWidth).toBeGreaterThan(600)
  expect(behavior.modalWidth).toBeLessThanOrEqual(680)
  expect(behavior.device).toBe('desktop')
  expect(behavior.scrolling).toBe('auto')
})

test('iframe completo mantém o menu limitado ao viewport do dispositivo', async ({ page }) => {
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
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ categorias: [], referencias: [], frames: [], redes: [], sobre: { nome: 'Luli' }, layout: {} }),
  }))
  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await page.locator('.cms-nav').getByRole('button', { name: /Layout/ }).click()
  const inlineFrame = page.locator('.cms-layout-inline-preview iframe')
  await page.getByRole('group', { name: 'Dispositivo da prévia completa' }).getByRole('button', { name: 'Celular' }).click()
  await inlineFrame.scrollIntoViewIfNeeded()
  await expect.poll(() => inlineFrame.evaluate(frame => Boolean(frame.contentDocument?.querySelector('.site-shell')))).toBe(true)
  await expect.poll(() => inlineFrame.evaluate(frame => frame.contentWindow.innerWidth)).toBe(390)
  const portfolio = page.frameLocator('.cms-layout-inline-preview iframe')
  await portfolio.locator('.editorial-menu-trigger').click()
  await expect(portfolio.locator('.editorial-menu-backdrop')).toHaveAttribute('aria-hidden', 'false')
  const bounds = await inlineFrame.evaluate(frame => {
    const view = frame.contentWindow
    const backdrop = frame.contentDocument.querySelector('.editorial-menu-backdrop')
    const panel = frame.contentDocument.querySelector('.editorial-menu-panel')
    const backdropRect = backdrop.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    return {
      width: view.innerWidth, height: view.innerHeight,
      backdropWidth: backdropRect.width, backdropHeight: backdropRect.height,
      panelWidth: panelRect.width, panelHeight: panelRect.height,
    }
  })
  expect(bounds.width).toBe(390)
  expect(bounds.backdropWidth).toBeLessThanOrEqual(bounds.width + 1)
  expect(bounds.backdropHeight).toBeLessThanOrEqual(bounds.height + 1)
  expect(bounds.panelWidth).toBeLessThanOrEqual(bounds.width + 1)
  expect(bounds.panelHeight).toBeLessThanOrEqual(bounds.height + 1)
})

test('campos e submenus de design são específicos por tipo de seção e começam recolhidos', async ({ page }) => {
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
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ categorias: [], referencias: [], frames: [], redes: [], sobre: { nome: 'Luli' }, layout: {} }),
  }))
  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await page.locator('.cms-nav').getByRole('button', { name: /Layout/ }).click()
  const library = page.locator('.cms-layout-section-library')
  const addMenu = library.locator('.cms-layout-library-add')
  await addMenu.locator('summary').click()
  await library.getByRole('button', { name: /Depoimentos/ }).click()
  const testimonial = library.locator('.cms-layout-custom-section').last()
  const contentMenu = testimonial.locator('details.cms-layout-custom-section-editor').first()
  const designMenu = testimonial.locator('details.cms-layout-custom-section-editor').nth(1)
  await expect(contentMenu).not.toHaveAttribute('open', '')
  await expect(designMenu).not.toHaveAttribute('open', '')
  await contentMenu.locator('summary').click()
  await testimonial.getByRole('button', { name: '+ Adicionar depoimento' }).click()
  await testimonial.locator('.cms-layout-custom-item summary').click()
  await expect(testimonial.getByRole('textbox', { name: 'Depoimento', exact: true })).toBeVisible()
  await expect(testimonial.getByLabel('Texto do depoimento', { exact: true })).toBeVisible()
  await designMenu.locator('summary').click()
  await expect(designMenu.getByText(/Dê protagonismo às falas/)).toBeVisible()
  await expect(designMenu.getByLabel('Estilo de apresentação')).toHaveValue('quotes')
})

test('layouts espaçosos não deixam um vão exagerado depois do contato', async ({ page }) => {
  await openLiveLayoutPreview(page)
  await sendSettings(page, { section_spacing: 'spacious', show_contact: true }, 'page')
  const gap = await page.evaluate(() => {
    const contact = document.querySelector('.secao-contato')
    const footer = document.querySelector('.rodape')
    return footer && contact ? footer.getBoundingClientRect().top - contact.getBoundingClientRect().bottom : 0
  })
  expect(gap).toBeLessThan(80)
})

test('prévia de hover foca a seção alterada e permite navegação no viewport simulado', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 })
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
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ categorias: [], referencias: [{ titulo: 'Referência', links: [] }], frames: [], redes: [], sobre: { nome: 'Luli' }, layout: {} }),
  }))
  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await page.locator('.cms-nav').getByRole('button', { name: /Layout/ }).click()
  const contentGroup = page.locator('.cms-layout-field-group').nth(1)
  await contentGroup.locator('summary').click()
  const contactField = contentGroup.locator('fieldset').filter({ hasText: 'Seção de contato' })
  await contactField.locator('.cms-layout-option').first().hover()
  const modal = page.locator('.cms-layout-hover-preview-floating')
  await expect(modal).toBeVisible()
  const frame = modal.locator('iframe')
  await expect.poll(() => frame.evaluate(element => element.contentWindow.scrollY)).toBeGreaterThan(0)
  await expect.poll(() => frame.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('auto')
})
