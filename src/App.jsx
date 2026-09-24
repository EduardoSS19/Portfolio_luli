import { useState } from 'react'
import { Hero } from './components/Hero.jsx'
import { Nav } from './components/Nav.jsx'
import { SecaoCategoria } from './components/SecaoCategoria.jsx'
import { categorias } from './data/obras.js'

export default function App() {
  const [categoriaAtiva, setCategoriaAtiva] = useState(categorias[0].titulo)

  function selecionarCategoria(titulo) {
    setCategoriaAtiva(titulo)
    document.getElementById(titulo)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div>
      <Hero
        nome="Luli Becker"
        frase="Cerâmica · Glitch Art · Gravura · Desenho"
      />
      <Nav
        categorias={categorias}
        categoriaAtiva={categoriaAtiva}
        aoSelecionar={selecionarCategoria}
      />
      {categorias.map(cat => (
        <SecaoCategoria
          key={cat.titulo}
          titulo={cat.titulo}
          chave={cat.chave}
          obras={cat.obras}
        />
      ))}
    </div>
  )
}
