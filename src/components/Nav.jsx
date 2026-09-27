export function Nav({ categorias, categoriaAtiva, animando, aoSelecionar }) {
  return (
    <nav>
      {categorias.map(cat => (
        <button
          key={cat.titulo}
          className={`${cat.titulo === categoriaAtiva ? 'ativo' : ''} ${animando === cat.chave ? `anim-${cat.chave}` : ''}`}
          onClick={() => aoSelecionar(cat.titulo)}
        >
          {cat.titulo}
        </button>
      ))}
    </nav>
  )
}