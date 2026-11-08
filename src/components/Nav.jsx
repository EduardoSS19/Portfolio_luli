import { useState } from 'react'

function tipoDeAnimacao(categoria) {
  const nome = `${categoria.titulo} ${categoria.chave}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
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
  const categoriaAtual = categorias.find(cat => cat.titulo === categoriaAtiva)
  const animacaoAtual = categoriaAtual && animando === categoriaAtual.chave
    ? `anim-${tipoDeAnimacao(categoriaAtual)}`
    : ''

  function selecionar(titulo) {
    aoSelecionar(titulo)
    setMenuAberto(false)
  }

  return (
    <nav className={`site-nav ${menuAberto ? 'menu-aberto' : ''}`}>
      <div className="nav-links" id="site-navigation">
        {categorias.map(cat => (
          <button
            type="button"
            key={cat.titulo}
            className={`${cat.titulo === categoriaAtiva ? 'ativo' : ''} ${animando === cat.chave || (menuAberto && cat.titulo === categoriaAtiva) ? `anim-${tipoDeAnimacao(cat)}` : ''}`}
            aria-current={cat.titulo === categoriaAtiva ? 'location' : undefined}
            onClick={() => selecionar(cat.titulo)}
          >
            {cat.titulo}
          </button>
        ))}
      </div>
      <div className="nav-gallery-switch" role="group" aria-label="Visualização das obras">
        <button type="button" aria-label="Visualizar em lista" title="Lista" className={modoGaleria === 'lista' ? 'ativo' : ''} aria-pressed={modoGaleria === 'lista'} onClick={() => aoTrocarModo('lista')}>
          <span aria-hidden="true">☷</span><span>Lista</span>
        </button>
        <button type="button" aria-label="Visualizar em grade" title="Grade" className={modoGaleria === 'grade' ? 'ativo' : ''} aria-pressed={modoGaleria === 'grade'} onClick={() => aoTrocarModo('grade')}>
          <span aria-hidden="true">▦</span><span>Grade</span>
        </button>
      </div>
      <button
        type="button"
        className="nav-mobile-toggle"
        aria-expanded={menuAberto}
        aria-controls="site-navigation"
        onClick={() => setMenuAberto(aberto => !aberto)}
      >
        <span className="nav-mobile-context">
          <span>NAVEGAR</span>
          <strong className={animacaoAtual}>{categoriaAtiva || 'Início'}</strong>
        </span>
        <span className={`nav-mobile-icon ${menuAberto ? 'aberto' : ''}`} aria-hidden="true">
          <i />
          <i />
        </span>
      </button>
    </nav>
  )
}