import { ObraCard } from './ObraCard.jsx'

function tipoDeArte(titulo, chave) {
  const nome = `${titulo} ${chave}`.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
  if (nome.includes('glitch')) return 'glitch'
  if (nome.includes('ceram')) return 'ceramica'
  if (nome.includes('gravura') || nome.includes('escultura')) return 'gravura'
  if (nome.includes('desenho')) return 'desenho'
  if (nome.includes('fotograf')) return 'fotografia'
  if (nome.includes('video')) return 'videoarte'
  return 'obra'
}

export function GaleriaGrade({ categorias }) {
  let indiceGlobal = 0
  const obras = categorias.flatMap(categoria => {
    const tipo = tipoDeArte(categoria.titulo, categoria.chave)
    return (categoria.obras || []).map((obra, indiceCategoria) => {
      const indice = indiceGlobal++
      return (
        <ObraCard
          key={`${categoria.chave}-${obra.titulo || indiceCategoria}-${indice}`}
          {...obra}
          categoria={categoria.chave}
          categoriaNome={categoria.titulo}
          tipoDeArte={tipo}
          modoGrade
          indiceGrade={indice}
          estiloGrade={{
            '--grade-delay': `${(indice % 3) * 95}ms`,
            '--grade-offset': indice % 2 === 0 ? '-12px' : '12px',
          }}
        />
      )
    })
  })

  return (
    <section className="galeria-grade-global" aria-label="Todas as obras">
      <div className="obras-lista modo-grade">{obras}</div>
    </section>
  )
}
