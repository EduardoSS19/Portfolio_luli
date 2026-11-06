import { useScrollReveal } from '../hooks/useScrollReveal.js'

function ReferenciaCard({ referencia, indice }) {
  const [ref, visivel] = useScrollReveal()

  return (
    <article
      ref={ref}
      className={`referencia-item ${visivel ? 'visivel' : ''}`}
      style={{ '--indice-referencia': indice }}
    >
      <h3>{referencia.titulo}</h3>
      {referencia.periodo && <span className="referencia-periodo">{referencia.periodo}</span>}
      {referencia.links.length > 0 && (
        <ul>
          {referencia.links.map((link, index) => (
            <li key={index}>
              <a href={link.url} target="_blank" rel="noreferrer">{link.texto}</a>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export function Referencias({ referencias }) {
  const [cabecalhoRef, cabecalhoVisivel] = useScrollReveal()
  if (referencias.length === 0) return null

  return (
    <section id="Referências" className="secao">
      <header
        ref={cabecalhoRef}
        className={`secao-cabecalho secao-cabecalho-referencias ${cabecalhoVisivel ? 'visivel' : ''}`}
      >
        <span className="secao-indice">PERCURSO</span>
        <h2>Referências</h2>
        <span className="secao-contagem">{String(referencias.length).padStart(2, '0')} itens</span>
      </header>
      <div className="referencias-lista">
        {referencias.map((referencia, indice) => (
          <ReferenciaCard key={`${referencia.titulo}-${indice}`} referencia={referencia} indice={indice} />
        ))}
      </div>
    </section>
  )
}