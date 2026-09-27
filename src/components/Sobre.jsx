export function Sobre({ perfil }) {
  return (
    <section id="Início" className="secao sobre-secao">
      <div className="obra">
        <div className="obra-imagem">
          <img src={perfil.foto} alt={perfil.nome} />
        </div>
        <div className="obra-texto">
          <span className="categoria-legenda">Início</span>
          <h2>{perfil.nome}</h2>
          {perfil.bio.map((paragrafo, index) => <p key={index}>{paragrafo}</p>)}
        </div>
      </div>
    </section>
  )
}