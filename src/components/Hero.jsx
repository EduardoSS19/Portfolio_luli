export function Hero({ nome, frase }) {
  return (
    <div className="hero">
      <span className="hero-kicker">PORTFÓLIO <span aria-hidden="true">/</span> IDENTIDADE AUTORAL</span>
      <h1>{nome}</h1>
      <p>{frase}</p>
      <span className="hero-linha" aria-hidden="true" />
    </div>
  )
}
