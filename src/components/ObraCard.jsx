import { useState } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal.js'

export function ObraCard({ titulo, icone, descricao, detalhe, categoria }) {
  const [expandido, setExpandido] = useState(false)
  const [ref, visivel] = useScrollReveal()

  return (
    <div
      ref={ref}
      className={`card reveal-${categoria} ${visivel ? 'visivel' : ''}`}
      onClick={() => setExpandido(!expandido)}
    >
      <div className="placeholder">{icone}</div>
      <div className="info">
        <h3>{titulo}</h3>
        <p>{descricao}</p>
        {expandido && <p className="detalhe">{detalhe}</p>}
        {!expandido && <p className="dica">clique para saber mais</p>}
      </div>
    </div>
  )
}
