import { ObraCard } from './ObraCard.jsx'

export function GaleriaGrade({ categorias }) {
  let indiceGlobal = 0
  const obras = categorias.flatMap(categoria => {
    const tipo = categoria.animacao || 'obra'
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
            '--grade-delay': `${(indice % 3) * 45}ms`,
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
