export function Footer({ nome, instagram, email }) {
  return (
    <footer className="rodape">
      <p>{nome}</p>
      <div className="rodape-links">
        {instagram && <a href={instagram} target="_blank" rel="noreferrer">Instagram</a>}
        {email && <a href={`mailto:${email}`}>Contato</a>}
      </div>
      <small>© {new Date().getFullYear()} — Todos os direitos reservados</small>
    </footer>
  );
}