import { test, expect } from '@playwright/test'

const pageSchema = {
  version: 1,
  pages: [
    { id: 'home', slug: 'inicio', title: 'Início', published: true, sections: [
      { id: 'opening', type: 'hero', settings: { title: 'Luli Becker', eyebrow: 'ARTISTA VISUAL', body: 'Arte, pesquisa e experimentação.' } },
      { id: 'works', type: 'gallery', settings: { title: 'Trabalhos selecionados', width: 'wide' } },
      { id: 'flash', type: 'tattoo-flash', settings: { title: 'Flash disponíveis' }, items: [{ title: 'Lua crescente', description: 'Blackwork autoral', image_url: 'https://example.com/lua.jpg', price: 'R$ 450', status: 'Disponível' }] },
      { id: 'references', type: 'references', settings: { title: 'Trajetória' }, items: [{ title: 'Exposição coletiva', period: '2025', venue: 'Museu de Arte', location: 'Porto Alegre' }] },
    ] },
    { id: 'about', slug: 'sobre', title: 'Sobre', published: true, sections: [
      { id: 'about-copy', type: 'rich-text', settings: { title: 'Sobre a artista', body: 'Pesquisa visual e processos.' } },
    ] },
  ],
}

async function openComposablePortfolio(page, presentation_mode = 'carousel', navigation_mode = 'curtain', gallery_view_count = '1', gallery_secondary_mode = 'masonry') {
  await page.route('**/api/portfolio/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categorias: [{ titulo: 'Pintura', chave: 'pintura', obras: [
        { titulo: 'Estudo de luz', imagem: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 100%22%3E%3Crect width=%2280%22 height=%22100%22 fill=%22%232c6688%22/%3E%3C/svg%3E', descricao: 'Camadas e cor.' },
        { titulo: 'Matéria em suspensão', imagem: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 100%22%3E%3Crect width=%2280%22 height=%22100%22 fill=%22%23a66b52%22/%3E%3C/svg%3E', descricao: 'Textura e memória.' },
        { titulo: 'Paisagem inventada', imagem: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 100%22%3E%3Crect width=%2280%22 height=%22100%22 fill=%22%237a8062%22/%3E%3C/svg%3E', descricao: 'Estudos de campo.' },
      ] }],
      referencias: [], frames: [], redes: [],
      sobre: { nome: 'Luli Becker', frase: 'Arte e experimentação', bio: 'Artista visual', email: 'contato@example.test', instagram: '', formulario: '' },
      layout: {
        page_schema: pageSchema,
        presentation_mode,
        gallery_view_count,
        gallery_secondary_mode,
        navigation_mode,
        default_theme: 'escuro',
        dark_color_background: '#061522',
        dark_color_surface: '#0b2943',
        dark_color_text: '#eff7ff',
        dark_color_muted: '#a9bdcc',
        dark_color_accent: '#93c8f2',
      },
    }),
  }))
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.composer-site')).toBeVisible()
  await expect(page.locator('.composer-hero h1')).toHaveText('Luli Becker')
}

test('menu cortina abre e fecha sem sobrepor permanentemente a página', async ({ page }) => {
  await openComposablePortfolio(page, 'carousel', 'curtain')
  const nav = page.locator('.composer-navigation')
  const trigger = nav.getByRole('button', { name: 'Abrir navegação' })
  await expect(nav).toHaveClass(/nav-style-curtain/)
  await expect(nav.locator('.composer-navigation-links')).toHaveAttribute('aria-hidden', 'true')
  await trigger.click()
  await expect(nav).toHaveClass(/is-open/)
  await expect(nav.locator('.composer-navigation-links')).toHaveAttribute('aria-hidden', 'false')
  await expect(nav.locator('.composer-navigation-links a')).toHaveCount(2)
  await nav.locator('.composer-navigation-links a').filter({ hasText: 'Sobre' }).click()
  await expect(page).toHaveURL(/\/sobre$/)
  await expect(page.locator('.composer-rich-text h2')).toHaveText('Sobre a artista')
})

test('prévia contextual pode mostrar a segunda experiência sem alterar a escolha principal', async ({ page }) => {
  await page.route('**/api/portfolio/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      categorias: [], referencias: [], frames: [], redes: [],
      sobre: { nome: 'Artista', frase: 'Portfólio', bio: '', email: '', instagram: '', formulario: '' },
      layout: { page_schema: pageSchema, presentation_mode: 'masonry', gallery_view_count: '2', gallery_secondary_mode: 'carousel', navigation_mode: 'dock' },
    }),
  }))
  await page.goto('/?layout_preview=1&layout_preview_compact=1', { waitUntil: 'domcontentloaded' })
  const site=page.locator('.composer-site')
  await expect(site).toHaveAttribute('data-gallery-mode','masonry')
  await page.evaluate(() => window.postMessage({
    type: 'cms-layout-preview:update',
    settings: { presentation_mode: 'masonry', gallery_view_count: '2', gallery_secondary_mode: 'carousel', navigation_mode: 'dock' },
    previewMode: 'carousel', focus: 'gallery', animatePreview: true,
  }, window.location.origin))
  await expect(site).toHaveAttribute('data-gallery-mode','carousel')
  const switcher=page.locator('.composer-gallery-view-switcher')
  await expect(switcher.getByRole('button',{name:'Carrossel horizontal'})).toHaveAttribute('aria-pressed','true')
  await expect(switcher.getByRole('button',{name:'Mosaico irregular'})).toHaveAttribute('aria-pressed','false')
})

test('galeria usa a apresentação escolhida e só oferece alternância quando duas experiências foram habilitadas', async ({ page }) => {
  await openComposablePortfolio(page, 'masonry', 'dock', '1', 'carousel')
  const site=page.locator('.composer-site')
  const gallery=page.locator('.composer-gallery')
  const works=gallery.locator('.obras-lista').first()
  await expect(site).toHaveAttribute('data-gallery-mode','masonry')
  await expect(gallery.locator('.composer-gallery-view-switcher')).toHaveCount(0)
  await expect.poll(()=>works.evaluate(node=>getComputedStyle(node).display)).toBe('grid')

  await openComposablePortfolio(page, 'masonry', 'dock', '2', 'carousel')
  const switcher=page.locator('.composer-gallery-view-switcher')
  await expect(switcher.getByRole('button',{name:'Mosaico irregular'})).toHaveAttribute('aria-pressed','true')
  await switcher.getByRole('button',{name:'Carrossel horizontal'}).click()
  await expect(site).toHaveAttribute('data-gallery-mode','carousel')
  await expect(switcher.getByRole('button',{name:'Carrossel horizontal'})).toHaveAttribute('aria-pressed','true')
  await expect.poll(()=>works.evaluate(node=>getComputedStyle(node).display)).toBe('flex')
  await switcher.getByRole('button',{name:'Mosaico irregular'}).click()
  await expect(site).toHaveAttribute('data-gallery-mode','masonry')
})

test('títulos longos cabem nos modelos suíço, flashbook, spotlight e brutalista', async ({ page }) => {
  const cases=['swiss','tattoo-book','spotlight','brutalist']
  for (const mode of cases) {
    await openComposablePortfolio(page, mode, 'dock')
    const heading=page.locator('.composer-hero h1')
    await heading.evaluate(node=>{node.textContent='ESTÚDIO DE DESIGN E EXPERIMENTAÇÃO VISUAL'})
    const metrics=await heading.evaluate(node=>({scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,scrollHeight:node.scrollHeight,rectHeight:node.getBoundingClientRect().height}))
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth+1)
    expect(metrics.rectHeight).toBeGreaterThan(40)
  }
})

test('mosaico irregular usa proporções e alturas realmente diferentes', async ({ page }) => {
  await openComposablePortfolio(page, 'masonry', 'dock')
  const cards=page.locator('.composer-gallery .obras-lista>.obra')
  const metrics=await cards.evaluateAll(nodes=>nodes.map(node=>{
    const style=getComputedStyle(node)
    return {columns:style.gridColumnEnd,rows:style.gridRowEnd,height:Math.round(node.getBoundingClientRect().height)}
  }))
  expect(new Set(metrics.map(item=>item.columns)).size).toBeGreaterThan(1)
  expect(new Set(metrics.map(item=>item.rows)).size).toBeGreaterThan(1)
  expect(Math.max(...metrics.map(item=>item.height))-Math.min(...metrics.map(item=>item.height))).toBeGreaterThan(80)
})

test('os modos de galeria alteram a composição real dos cards', async ({ page }) => {
  const cases = [
    ['carousel', 'flex', 'x'],
    ['filmstrip', 'flex', 'x'],
    ['timeline', 'flex', 'x'],
    ['masonry', 'grid', ''],
    ['immersive', 'grid', ''],
    ['brutalist', 'grid', ''],
    ['stack', 'grid', ''],
    ['spotlight', 'grid', ''],
    ['museum', 'grid', ''],
    ['cinematic', 'flex', 'x'],
    ['swiss', 'grid', ''],
    ['tattoo-book', 'grid', ''],
  ]
  for (const [mode, display, snap] of cases) {
    await openComposablePortfolio(page, mode, 'dock')
    const gallery = page.locator('.composer-gallery .obras-lista').first()
    await expect(gallery).toBeVisible()
    const actual = await gallery.evaluate(element => ({
      display: getComputedStyle(element).display,
      snap: getComputedStyle(element).scrollSnapType,
      cards: element.querySelectorAll(':scope > .obra').length,
    }))
    expect(actual.display, mode).toBe(display)
    expect(actual.cards, mode).toBe(3)
    if (snap) expect(actual.snap, mode).toContain(snap)
  }
})

test('navegações dropdown, lateral e índice são controles acessíveis e interativos', async ({ page }) => {
  const cases = [
    ['dropdown', 'Abrir menu'],
    ['sidebar', 'Abrir índice lateral'],
    ['index', 'Abrir índice de capítulos'],
  ]
  for (const [mode, label] of cases) {
    await openComposablePortfolio(page, 'editorial', mode)
    const nav = page.locator('.composer-navigation')
    await expect(nav).toHaveClass(new RegExp('nav-style-' + mode))
    const trigger = nav.getByRole('button', { name: label })
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await trigger.click()
    await expect(nav).toHaveClass(/is-open/)
    await expect(nav.locator('.composer-navigation-links')).toHaveAttribute('aria-hidden', 'false')
    await expect(nav.locator('.composer-navigation-links a')).toHaveCount(2)
    await expect(nav.locator('.composer-navigation-links a').first()).toBeVisible()
  }
})

test('layout rail e dock mantêm links visíveis e responsivos', async ({ page }) => {
  for (const mode of ['rail', 'dock']) {
    await openComposablePortfolio(page, 'editorial', mode)
    const nav = page.locator('.composer-navigation')
    await expect(nav).toHaveClass(new RegExp('nav-style-' + mode))
    await expect(nav.locator('.composer-navigation-links')).toBeVisible()
    await expect(nav.locator('.composer-navigation-links a')).toHaveCount(2)
    await expect(nav.getByRole('button')).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(nav.locator('.composer-navigation-links')).toBeVisible()
  }
})

test('conteúdo de flash e referências é preenchido e exibido a partir da própria sessão', async ({ page }) => {
  await openComposablePortfolio(page, 'editorial', 'curtain')
  const flash = page.locator('#flash')
  await expect(flash).toContainText('Lua crescente')
  await expect(flash).toContainText('R$ 450')
  await expect(flash).toContainText('Disponível')
  const references = page.locator('#references')
  await expect(references).toContainText('Exposição coletiva')
  await expect(references).toContainText('Museu de Arte')
  await expect(references).toContainText('Porto Alegre')
})

test('CMS mantém conteúdo de flash na área Páginas e salva os itens da sessão', async ({ page }) => {
  let savedPayload = null
  const initialSchema = {
    version: 1,
    pages: [{ id: 'home', slug: 'inicio', title: 'Início', published: true, sections: [
      { id: 'flash', type: 'tattoo-flash', settings: { title: 'Flash disponíveis' }, items: [] },
    ] }],
  }
  await page.route('**/api/cms/layout/', async route => {
    if (route.request().method() === 'PATCH') {
      savedPayload = JSON.parse(route.request().postData() || '{}')
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: { page_schema: savedPayload.page_schema } }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      settings: { page_schema: initialSchema }, permissions: { canView: true, canChange: true },
    }) })
  })
  await page.route('**/api/portfolio/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ categorias: [], referencias: [], frames: [], redes: [], sobre: { nome: 'Luli' }, layout: {} }),
  }))
  await page.goto('/painel', { waitUntil: 'domcontentloaded' })
  await page.locator('.cms-nav').getByRole('button', { name: /Páginas/ }).click()
  await page.locator('.cms-pages-tree-section').getByRole('button', { name: 'Flash de tatuagem' }).click()
  const editor = page.locator('.cms-pages-items-editor')
  await expect(editor).toBeVisible()
  await editor.getByRole('button', { name: /Adicionar item/ }).click()
  const item = page.locator('.cms-pages-item-card').first()
  await item.getByLabel('Título').fill('Lua crescente')
  await item.getByLabel('Descrição').fill('Blackwork autoral')
  await item.getByLabel('Valor').fill('R$ 450')
  await item.getByLabel('Disponibilidade').fill('Disponível')
  await page.getByRole('button', { name: 'Salvar estrutura' }).click()
  await expect.poll(() => savedPayload?.page_schema?.pages?.[0]?.sections?.[0]?.items?.[0]?.title).toBe('Lua crescente')
  expect(savedPayload.page_schema.pages[0].sections[0].items[0].price).toBe('R$ 450')
})
