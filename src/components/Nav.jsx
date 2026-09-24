export function Nav({ categorias, categoriaAtiva, aoSelecionar }) {
  return (
    <nav>
      {categorias.map(cat => (
        <button
          key={cat.titulo}
          className={cat.titulo === categoriaAtiva ? 'ativo' : ''}
          onClick={() => aoSelecionar(cat.titulo)}
        >
          {cat.titulo}
        </button>
      ))}
    </nav>
  )
}
