export function Referencias({ referencias }) {
  return (
    <section id="Referências" className="secao">
      <h2>Referências</h2>
      <div className="referencias-lista">
        {referencias.map((ref, i) => (
          <div key={i} className="referencia-item">
            <h3>{ref.titulo}</h3>
            <span className="referencia-periodo">{ref.periodo}</span>
            <ul>
              {ref.links.map((link, j) => (
                <li key={j}>
                  <a href={link.url} target="_blank" rel="noreferrer">{link.texto}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}