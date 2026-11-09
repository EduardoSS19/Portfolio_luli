import { useEffect, useRef, useState } from 'react'

function tipoDeAnimacao(categoria) {
  const nome = `${categoria.titulo} ${categoria.chave}`.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
  if (nome.includes('ceram')) return 'ceramica'
  if (nome.includes('glitch')) return 'glitch'
  if (nome.includes('gravura') || nome.includes('escultura')) return 'gravura'
  if (nome.includes('desenho')) return 'desenho'
  if (nome.includes('referencia')) return 'referencias'
  if (nome.includes('contato')) return 'contato'
  return 'inicio'
}

export function Nav({ categorias, categoriaAtiva, animando, aoSelecionar, modoGaleria, aoTrocarModo }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const botaoMenuRef = useRef(null)
  const primeiroLinkRef = useRef(null)
  const overflowAnteriorRef = useRef('')
  const categoriaAtual = categorias.find(cat => cat.titulo === categoriaAtiva)
  const animacaoAtual = categoriaAtual && animando === categoriaAtual.chave
    ? `anim-${tipoDeAnimacao(categoriaAtual)}`
    : ''

  useEffect(() => {
    if (!menuAberto) return undefined

    const focoAnterior = document.activeElement
    overflowAnteriorRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    primeiroLinkRef.current?.focus()

    function tratarTeclado(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        setMenuAberto(false)
        return
      }
      if (evento.key !== 'Tab') return
      const links = [...document.querySelectorAll('.nav-overlay-link')]
      if (!links.length) return
      const primeiro = links[0]
      const ultimo = links[links.length - 1]
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', tratarTeclado)
    return () => {
      document.removeEventListener('keydown', tratarTeclado)
      document.body.style.overflow = overflowAnteriorRef.current
      if (focoAnterior instanceof HTMLElement) focoAnterior.focus()
    }
  }, [menuAberto])

  function selecionar(titulo) {
    // Libera a rolagem antes de iniciar o scroll suave da seção selecionada.
    document.body.style.overflow = overflowAnteriorRef.current
    setMenuAberto(false)
    aoSelecionar(titulo)
  }

  function fecharAoClicarNoFundo(evento) {
    if (evento.target === evento.currentTarget) setMenuAberto(false)
  }

  return (
    <nav className={`site-nav editorial-nav ${menuAberto ? 'menu-aberto' : ''}`} aria-label="Navegação principal">
      <button
        ref={botaoMenuRef}
        type="button"
        className="editorial-menu-trigger"
        aria-expanded={menuAberto}
        aria-controls="editorial-navigation"
        onClick={() => setMenuAberto(aberto => !aberto)}
      >
        <span className="editorial-menu-trigger-label">{menuAberto ? 'FECHAR' : 'MENU'}</span>
        <span className={`editorial-menu-mark ${menuAberto ? 'aberto' : ''}`} aria-hidden="true">
          <i /><i />
        </span>
      </button>

      <div
        className="editorial-menu-backdrop"
        id="editorial-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="Menu do portfólio"
        aria-hidden={!menuAberto}
        onMouseDown={fecharAoClicarNoFundo}
        onTouchStart={fecharAoClicarNoFundo}
      >
        <div className="editorial-menu-panel">
          <div className="editorial-menu-heading">
            <span>NAVEGAÇÃO</span>
            <p>Explore o portfólio</p>
          </div>
          <div className="editorial-menu-links">
            {categorias.map((cat, indice) => (
              <button
                ref={indice === 0 ? primeiroLinkRef : undefined}
                type="button"
                key={cat.titulo}
                className={`nav-overlay-link ${cat.titulo === categoriaAtiva ? 'ativo' : ''} ${animando === cat.chave ? `anim-${tipoDeAnimacao(cat)}` : ''}`}
                aria-current={cat.titulo === categoriaAtiva ? 'location' : undefined}
                onClick={() => selecionar(cat.titulo)}
              >
                <span className="editorial-menu-number">{String(indice + 1).padStart(2, '0')}</span>
                <span className="editorial-menu-title">{cat.titulo}</span>
                <span className="editorial-menu-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          <div className="editorial-menu-footer">
            <span>ARTE · PESQUISA · EXPERIMENTAÇÃO</span>
            <span>PORTO ALEGRE, BRASIL</span>
          </div>
        </div>
      </div>

      <div className="nav-gallery-switch" role="group" aria-label="Visualização das obras">
        <button type="button" aria-label="Visualizar em lista" title="Lista" className={modoGaleria === 'lista' ? 'ativo' : ''} aria-pressed={modoGaleria === 'lista'} onClick={() => aoTrocarModo('lista')}>
          <span aria-hidden="true">☷</span><span>Lista</span>
        </button>
        <button type="button" aria-label="Visualizar em grade" title="Grade" className={modoGaleria === 'grade' ? 'ativo' : ''} aria-pressed={modoGaleria === 'grade'} onClick={() => aoTrocarModo('grade')}>
          <span aria-hidden="true">▦</span><span>Grade</span>
        </button>
      </div>
    </nav>
  )
}
