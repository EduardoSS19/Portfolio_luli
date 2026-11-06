import { ObraCard } from './ObraCard.jsx'
import { useScrollReveal } from '../hooks/useScrollReveal.js'

function tipoDeArte(titulo, chave) {
  const nome = `${titulo} ${chave}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (nome.includes('glitch')) return 'glitch'
  if (nome.includes('ceram')) return 'ceramica'
  if (nome.includes('gravura') || nome.includes('escultura')) return 'gravura'
  if (nome.includes('desenho')) return 'desenho'
  return 'obra'
}

export function SecaoCategoria({ titulo, chave, obras, indice = 0 }) {
  const tipo = tipoDeArte(titulo, chave)
  const [cabecalhoRef, cabecalhoVisivel] = useScrollReveal()

  return (
    <section className="secao" id={titulo}>
      <header
        ref={cabecalhoRef}
        className={`secao-cabecalho arte-${tipo} ${cabecalhoVisivel ? 'visivel' : ''}`}
      >
        <span className="secao-indice">SÉRIE {String(indice + 1).padStart(2, '0')}</span>
        <h2>{titulo}</h2>
        <span className="secao-contagem">{String(obras.length).padStart(2, '0')} {obras.length === 1 ? 'obra' : 'obras'}</span>
      </header>
      <div className="obras-lista">
        {obras.map((obra, i) => (
          <ObraCard
            key={i}
            {...obra}
            categoria={chave}
            categoriaNome={titulo}
            tipoDeArte={tipo}
            invertido={i % 2 === 1}
          />
        ))}
      </div>
    </section>
  )
}