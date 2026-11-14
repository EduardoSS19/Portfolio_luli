import { ObraCard } from './ObraCard.jsx'
import { useScrollReveal } from '../hooks/useScrollReveal.js'

export function SecaoCategoria({ titulo, chave, animacao = 'obra', obras, indice = 0, modoVisualizacao = 'lista', indiceInicial = 0, animando = false }) {
  const tipo = animacao || 'obra'
  const [cabecalhoRef, cabecalhoVisivel] = useScrollReveal()

  return (
    <section className="secao" id={titulo}>
      <header
        ref={cabecalhoRef}
        className={`secao-cabecalho arte-${tipo} ${cabecalhoVisivel ? 'visivel' : ''} ${animando ? 'animando' : ''}`}
      >
        <span className="secao-indice">SÉRIE {String(indice + 1).padStart(2, '0')}</span>
        <h2>{titulo}</h2>
        <span className="secao-contagem">{String(obras.length).padStart(2, '0')} {obras.length === 1 ? 'obra' : 'obras'}</span>
      </header>
      <div className={`obras-lista ${modoVisualizacao === 'grade' ? 'modo-grade' : ''}`}>
        {obras.map((obra, i) => {
          const indiceGlobal = indiceInicial + i
          const linha = Math.floor(indiceGlobal / 3)
          const coluna = indiceGlobal % 3
          const ordemCobrinha = linha % 2 === 0 ? coluna : 2 - coluna
          return (
            <ObraCard
              key={obra.titulo || i}
              {...obra}
              categoria={chave}
              categoriaNome={titulo}
              tipoDeArte={tipo}
              invertido={modoVisualizacao === 'lista' && i % 2 === 1}
              modoGrade={modoVisualizacao === 'grade'}
              indiceGrade={i}
              estiloGrade={{
                '--grade-delay': `${((linha * 3 + ordemCobrinha) % 12) * 75}ms`,
                '--grade-offset': linha % 2 === 0 ? '18px' : '-18px',
              }}
            />
          )
        })}
      </div>
    </section>
  )
}