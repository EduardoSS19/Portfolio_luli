import { useState, useEffect, useMemo, useRef } from 'react'
import { FundoFantasma } from './components/FundoFantasma.jsx'
import { Hero } from './components/Hero.jsx'
import { Nav } from './components/Nav.jsx'
import { Sobre } from './components/Sobre.jsx'
import { SecaoCategoria } from './components/SecaoCategoria.jsx'
import { Referencias } from './components/Referencias.jsx'
import { Footer } from './components/Footer.jsx'
import { categorias as categoriasIniciais } from './data/obras.js'
import { referencias as referenciasIniciais } from './data/referencias.js'
import { bioParagrafos, fotoLuisa } from './data/sobre.js'
import { useSecaoAtiva } from './hooks/useSecaoAtiva.js'
import { Contato } from './components/Contato.jsx'

export default function App() {
  const [conteudo, setConteudo] = useState({
    categorias: categoriasIniciais,
    referencias: referenciasIniciais,
    sobre: { nome: 'Luísa Becker', foto: fotoLuisa, bio: bioParagrafos },
  })
  const categorias = conteudo.categorias
  const referencias = conteudo.referencias
  const sobre = conteudo.sobre
  const secoesNav = useMemo(() => [
    { titulo: 'Início', chave: 'inicio' },
    ...categorias.map(c => ({ titulo: c.titulo, chave: c.chave })),
    { titulo: 'Referências', chave: 'referencias' },
    { titulo: 'Contato', chave: 'contato' },
  ], [categorias])
  const secaoAtiva = useSecaoAtiva(secoesNav)
  const [animando, setAnimando] = useState(null)
  const anteriorRef = useRef(secaoAtiva)

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/portfolio/', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`API respondeu ${response.status}`)
        return response.json()
      })
      .then(data => {
        setConteudo(atual => ({
          categorias: Array.isArray(data.categorias) ? data.categorias : atual.categorias,
          referencias: Array.isArray(data.referencias) ? data.referencias : atual.referencias,
          sobre: data.sobre && Array.isArray(data.sobre.bio) ? data.sobre : atual.sobre,
        }))
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.warn('Não foi possível carregar o conteúdo do Django; usando os dados locais.', error)
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (secaoAtiva !== anteriorRef.current) {
      const sec = secoesNav.find(s => s.titulo === secaoAtiva)
      anteriorRef.current = secaoAtiva
      if (sec) {
        setAnimando(sec.chave)
        const timer = setTimeout(() => setAnimando(null), 550)
        return () => clearTimeout(timer)
      }
    }
  }, [secaoAtiva])

  function selecionarCategoria(titulo) {
    document.getElementById(titulo)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div>
      <FundoFantasma secaoAtiva={secaoAtiva} secoes={secoesNav} />
      <Hero nome={sobre.nome} frase="Cerâmica · Glitch Art · Gravura · Desenho" />
      <Nav
        categorias={secoesNav}
        categoriaAtiva={secaoAtiva}
        animando={animando}
        aoSelecionar={selecionarCategoria}
      />
      <Sobre perfil={sobre} />
      {categorias.map(cat => (
        <SecaoCategoria key={cat.titulo} titulo={cat.titulo} chave={cat.chave} obras={cat.obras} />
      ))}
      <Referencias referencias={referencias} />
      <Contato />
      <Footer nome={sobre.nome} />
    </div>
  )
}