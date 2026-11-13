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

export function Nav({ categorias, categoriaAtiva, animando, aoSelecionar, modoGaleria, aoTrocarModo, tema, aoTrocarTema, imagemMarca }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const botaoMenuRef = useRef(null)
  const primeiroLinkRef = useRef(null)
  const overflowAnteriorRef = useRef({ body: '', html: '' })
  const categoriaAtual = categorias.find(cat => cat.titulo === categoriaAtiva)
  const animacaoAtual = categoriaAtual && animando === categoriaAtual.chave
    ? `anim-${tipoDeAnimacao(categoriaAtual)}`
    : ''

  useEffect(() => {
    if (!menuAberto) return undefined

    const focoAnterior = document.activeElement
    overflowAnteriorRef.current = {
      body: document.body.style.overflow,
      html: document.documentElement.style.overflow,
    }
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    primeiroLinkRef.current?.focus()

    function tratarTeclado(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        setMenuAberto(false)
        return
      }
      if (evento.key !== 'Tab') return
      const links = [...document.querySelectorAll('.nav-overlay-link, .editorial-menu-control')]
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
      document.body.style.overflow = overflowAnteriorRef.current.body
      document.documentElement.style.overflow = overflowAnteriorRef.current.html
      if (focoAnterior instanceof HTMLElement) focoAnterior.focus()
    }
  }, [menuAberto])

  function selecionar(titulo) {
    // Libera a rolagem antes de iniciar o scroll suave da seção selecionada.
    document.body.style.overflow = overflowAnteriorRef.current.body
    document.documentElement.style.overflow = overflowAnteriorRef.current.html
    setMenuAberto(false)
    // Aguarda o overlay sair da árvore de interação antes de rolar. Isso evita
    // o scrollIntoView ser consumido pelo scroll-lock do Safari/iOS.
    requestAnimationFrame(() => requestAnimationFrame(() => aoSelecionar(titulo)))
  }

  function fecharAoClicarNoFundo(evento) {
    if (evento.target === evento.currentTarget) setMenuAberto(false)
  }

  function alternarModoGaleria() {
    aoTrocarModo(modoGaleria === 'lista' ? 'grade' : 'lista')
    setMenuAberto(false)
  }

  return (
    <nav className={`site-nav editorial-nav ${menuAberto ? 'menu-aberto' : ''}`} aria-label="Navegação principal">
      <button type="button" className="site-home-brand" aria-label="Ir para o início do portfólio" onClick={() => selecionar('Início')}>
        {imagemMarca ? <img src={imagemMarca} alt="" /> : <span>Início</span>}
      </button>

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
                className={`nav-overlay-link ${cat.titulo === categoriaAtiva ? 'ativo' : ''} ${menuAberto ? `entrada-${tipoDeAnimacao(cat)}` : ''} ${animando === cat.chave ? `anim-${tipoDeAnimacao(cat)}` : ''}`}
                style={{ '--menu-index': indice }}
                aria-current={cat.titulo === categoriaAtiva ? 'location' : undefined}
                onClick={() => selecionar(cat.titulo)}
              >
                <span className="editorial-menu-number">{String(indice + 1).padStart(2, '0')}</span>
                <span className="editorial-menu-title">{cat.titulo}</span>
                <span className="editorial-menu-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          <div className="editorial-menu-controls" role="group" aria-label="Preferências de visualização">
            <button type="button" className="editorial-menu-control" onClick={() => aoTrocarTema()} aria-label={tema === 'escuro' ? 'Ativar tema claro' : 'Ativar tema escuro'}>
              <span aria-hidden="true">{tema === 'escuro' ? '☼' : '☾'}</span>
              <span>{tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}</span>
            </button>
            <button type="button" className="editorial-menu-control" onClick={alternarModoGaleria} aria-label={modoGaleria === 'lista' ? 'Alternar para visualização em grade' : 'Alternar para visualização em lista'}>
              <span aria-hidden="true">{modoGaleria === 'lista' ? '▦' : '☷'}</span>
              <span>{modoGaleria === 'lista' ? 'Ver em grade' : 'Ver em lista'}</span>
            </button>
          </div>
          <div className="editorial-menu-footer">
            <span>ARTE · PESQUISA · EXPERIMENTAÇÃO</span>
            <span>PORTO ALEGRE, BRASIL</span>
          </div>
        </div>
      </div>

    </nav>
  )
}
