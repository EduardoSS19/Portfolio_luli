import { useScrollReveal } from '../hooks/useScrollReveal.js'

export function Sobre({ perfil, mostrarImagem = true, mostrarBio = true }) {
  const [ref, visivel] = useScrollReveal()

  return (
    <section id="Início" className="secao sobre-secao">
      <div ref={ref} className={`obra sobre-entrada ${!mostrarImagem ? 'sem-imagem' : ''} ${visivel ? 'visivel' : ''}`}>
        {mostrarImagem && <div className={`obra-imagem ${perfil.foto ? '' : 'obra-imagem-placeholder'}`}>
          {perfil.foto ? <img src={perfil.foto} alt={perfil.nome} /> : <span>Foto da artista</span>}
        </div>}
        <div className="obra-texto">
          <span className="categoria-legenda">Início</span>
          <h2>{perfil.nome}</h2>
          {mostrarBio && <p className="biografia" style={{ whiteSpace: 'pre-line' }}>{perfil.bio}</p>}
        </div>
      </div>
    </section>
  )
}