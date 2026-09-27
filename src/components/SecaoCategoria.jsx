import { ObraCard } from './ObraCard.jsx'

export function SecaoCategoria({ titulo, chave, obras }) {
  return (
    <section className="secao" id={titulo}>
      <h2>{titulo}</h2>
      <div className="obras-lista">
        {obras.map((obra, i) => (
          <ObraCard
            key={i}
            {...obra}
            categoria={chave}
            categoriaNome={titulo}
            invertido={i % 2 === 1}
          />
        ))}
      </div>
    </section>
  )
}