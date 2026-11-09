import { test, expect } from '@playwright/test'

test('aplica a identidade visual retornada pelo CMS ao site', async ({ page }) => {
  await page.route('**/api/portfolio/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      aparencia: {
        accent: '#D49BFF',
        background: '#101018',
        backgroundAlt: '#282038',
        surface: '#211A30',
        text: '#FFF8FF',
        border: '#D49BFF',
      },
      categorias: [],
      referencias: [],
      frames: [],
      redes: [],
      sobre: { nome: 'Luli', frase: 'Arte e experimentação', bio: 'Artista', email: '', instagram: '', formulario: '' },
    }),
  }))

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luli')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--azul-claro').trim())).toBe('#D49BFF')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--azul-escuro').trim())).toBe('#101018')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cor-fundo-alt').trim())).toBe('#282038')
})
