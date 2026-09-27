import { bioParagrafos, fotoLuisa } from '../data/sobre.js'

export function Sobre() {
  return (
    <section id="Início" className="secao sobre-secao">
      <div className="obra">
        <div className="obra-imagem">
          <img src={fotoLuisa} alt="Luísa Becker" />
        </div>
        <div className="obra-texto">
          <span className="categoria-legenda">Início</span>
          <h2>Luísa Becker</h2>
          {bioParagrafos.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </div>
    </section>
  )
}