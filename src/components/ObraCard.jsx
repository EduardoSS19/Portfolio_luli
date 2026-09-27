import { useState } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal.js'

export function ObraCard({ titulo, imagem, descricao, detalhe, categoria, categoriaNome, invertido }) {
  const [expandido, setExpandido] = useState(false)
  const [ref, visivel] = useScrollReveal()

  return (
    <div
      ref={ref}
      className={`obra reveal-${categoria} ${visivel ? 'visivel' : ''} ${invertido ? 'invertido' : ''}`}
      onClick={() => setExpandido(!expandido)}
    >
      <div className="obra-imagem">
        <img src={imagem} alt={titulo} />
      </div>
      <div className="obra-texto">
        <span className="categoria-legenda">{categoriaNome}</span>
        <h3>{titulo}</h3>
        <p>{descricao}</p>

        <div className={`detalhe-wrapper ${expandido ? 'aberto' : ''}`}>
          <div className="detalhe-inner">
            <p className="detalhe">{detalhe}</p>
          </div>
        </div>

        <p className="dica">{expandido ? 'clique para fechar' : 'clique para saber mais'}</p>
      </div>
    </div>
  )
}