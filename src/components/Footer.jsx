export function Footer({ nome, instagram, email, redes = [] }) {
  const temInstagramNaLista = redes.some(rede => (
    rede.titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'instagram'
  ))
  const linksRedes = instagram && !temInstagramNaLista
    ? [{ titulo: 'Instagram', url: instagram }, ...redes]
    : redes

  return (
    <footer className="rodape">
      <p>{nome}</p>
      <div className="rodape-links">
        {linksRedes.map((rede, indice) => (
          <a key={`${rede.url}-${indice}`} href={rede.url} target="_blank" rel="noreferrer">
            {rede.titulo}
          </a>
        ))}
        {email && <a href={`mailto:${email}`}>Contato</a>}
      </div>
      <small>© {new Date().getFullYear()} — Todos os direitos reservados</small>
      <div className="rodape-creditos">
        <span>Desenvolvido por <strong>Eduardo</strong></span>
        <a href="mailto:leduardoss19@gmail.com">leduardoss19@gmail.com</a>
      </div>
    </footer>
  );
}