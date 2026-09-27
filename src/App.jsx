import { useState, useEffect, useMemo, useRef } from 'react'
import { FundoFantasma } from './components/FundoFantasma.jsx'
import { Hero } from './components/Hero.jsx'
import { Nav } from './components/Nav.jsx'
import { Sobre } from './components/Sobre.jsx'
import { SecaoCategoria } from './components/SecaoCategoria.jsx'
import { Referencias } from './components/Referencias.jsx'
import { Footer } from './components/Footer.jsx'
import { useSecaoAtiva } from './hooks/useSecaoAtiva.js'
import { Contato } from './components/Contato.jsx'

const perfilInicial = {
  nome: 'Nome da artista',
  frase: 'Arte · Pesquisa · Experimentação',
  foto: '',
  bio: ['Lorem ipsum dolor sit amet, consectetur adipiscing elit.'],
  instagram: '',
  email: '',
  formulario: '',
}

export default function App() {
  const [conteudo, setConteudo] = useState({
    categorias: [],
    referencias: [],
    frames: [],
    sobre: null,
  })
  const categorias = conteudo.categorias
  const referencias = conteudo.referencias
  const sobre = conteudo.sobre ?? perfilInicial
  const secoesNav = useMemo(() => [
    { titulo: 'Início', chave: 'inicio' },
    ...categorias.map(c => ({ titulo: c.titulo, chave: c.chave })),
    ...(referencias.length ? [{ titulo: 'Referências', chave: 'referencias' }] : []),
    ...(sobre.email || sobre.formulario ? [{ titulo: 'Contato', chave: 'contato' }] : []),
  ], [categorias, referencias.length, sobre.email, sobre.formulario])
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
          categorias: Array.isArray(data.categorias) ? data.categorias : [],
          referencias: Array.isArray(data.referencias) ? data.referencias : [],
          frames: Array.isArray(data.frames) ? data.frames : [],
          sobre: data.sobre && Array.isArray(data.sobre.bio) ? data.sobre : null,
        }))
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.warn('Não foi possível carregar o conteúdo do Django.', error)
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
      <FundoFantasma frames={conteudo.frames} secaoAtiva={secaoAtiva} secoes={secoesNav} />
      <Hero nome={sobre.nome} frase={sobre.frase} />
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
      {referencias.length > 0 && <Referencias referencias={referencias} />}
      <Contato endpoint={sobre.formulario} email={sobre.email} />
      <Footer nome={sobre.nome} instagram={sobre.instagram} email={sobre.email} />
    </div>
  )
}