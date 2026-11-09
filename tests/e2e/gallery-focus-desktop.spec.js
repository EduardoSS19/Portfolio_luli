import { test, expect } from '@playwright/test'

const imagem = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 100%22%3E%3Crect width=%2280%22 height=%22100%22 fill=%22%231e6688%22/%3E%3C/svg%3E'

test('no foco desktop, as informações da obra continuam visíveis sem controle de expansão', async ({ page }) => {
  await page.route('**/api/portfolio/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categorias: [{
        titulo: 'Cerâmica',
        chave: 'ceramica',
        obras: [{
          titulo: 'Vaso de estudo',
          imagem,
          midias: [{ tipo: 'imagem', src: imagem }],
          descricao: 'Peça experimental em argila.',
          detalhe: 'Queima em alta temperatura.',
          dimensoes: '20 × 30 cm',
          ano: 2026,
        }],
      }],
      referencias: [],
      frames: [],
      redes: [],
      sobre: { nome: 'Luli', frase: 'Arte e experimentação', bio: 'Artista', email: '', instagram: '', formulario: '' },
    }),
  }))

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luli')
  await page.locator('.editorial-menu-trigger').click()
  await page.getByRole('button', { name: 'Alternar para visualização em grade' }).click()

  const card = page.locator('.galeria-grade-global .obra').first()
  await card.locator('.obra-zoom-trigger').click()

  const dialog = page.getByLabel('Visualização ampliada de Vaso de estudo')
  await expect(dialog).toHaveAttribute('open', '')
  const metadados = dialog.locator('.obra-focus-metadados')
  await expect(metadados).toBeVisible()
  await expect(metadados).toContainText('Peça experimental em argila.')
  await expect(metadados).toContainText('Queima em alta temperatura.')
  await expect(metadados).toContainText('20 × 30 cm')
  await expect(dialog.getByRole('button', { name: 'Ver informações da obra' })).toBeHidden()
})
