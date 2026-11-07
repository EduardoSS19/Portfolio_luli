import { useState } from 'react'
import { ObraCard } from './ObraCard.jsx'
import { useScrollReveal } from '../hooks/useScrollReveal.js'

function tipoDeArte(titulo, chave) {
  const nome = `${titulo} ${chave}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (nome.includes('glitch')) return 'glitch'
  if (nome.includes('ceram')) return 'ceramica'
  if (nome.includes('gravura') || nome.includes('escultura')) return 'gravura'
  if (nome.includes('desenho')) return 'desenho'
  if (nome.includes('fotograf')) return 'fotografia'
  if (nome.includes('video')) return 'videoarte'
  return 'obra'
}

export function SecaoCategoria({ titulo, chave, obras, indice = 0 }) {
  const tipo = tipoDeArte(titulo, chave)
  const [cabecalhoRef, cabecalhoVisivel] = useScrollReveal()
  const [modoVisualizacao, setModoVisualizacao] = useState('lista')

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
      <div className="galeria-controles" role="group" aria-label={`Modo de visualização da categoria ${titulo}`}>
        <span>VISUALIZAÇÃO</span>
        <button type="button" className={modoVisualizacao === 'lista' ? 'ativo' : ''} aria-pressed={modoVisualizacao === 'lista'} onClick={() => setModoVisualizacao('lista')}>
          <span aria-hidden="true">☷</span> Lista
        </button>
        <button type="button" className={modoVisualizacao === 'grade' ? 'ativo' : ''} aria-pressed={modoVisualizacao === 'grade'} onClick={() => setModoVisualizacao('grade')}>
          <span aria-hidden="true">▦</span> Grade
        </button>
      </div>
      <div className={`obras-lista ${modoVisualizacao === 'grade' ? 'modo-grade' : ''}`}>
        {obras.map((obra, i) => {
          const linha = Math.floor(i / 3)
          const coluna = i % 3
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
                '--grade-delay': `${ordemCobrinha * 90}ms`,
                '--grade-offset': linha % 2 === 0 ? '18px' : '-18px',
              }}
            />
          )
        })}
      </div>
    </section>
  )
}