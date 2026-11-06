export function Footer({ nome, instagram, email, redes = [] }) {
  const linksRedes = redes.length
    ? redes
    : instagram
      ? [{ titulo: 'Instagram', url: instagram }]
      : []

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
    </footer>
  );
}