import { ObraCard } from './ObraCard.jsx'

export function SecaoCategoria({ titulo, chave, obras }) {
  return (
    <section className="secao" id={titulo}>
      <h2>{titulo}</h2>
      <div className="cartoes">
        {obras.map((obra, i) => (
          <ObraCard key={i} {...obra} categoria={chave} />
        ))}
      </div>
    </section>
  )
}
