export function Footer({ nome }) {
  return (
    <footer className="rodape">
      <p>{nome}</p>
      <div className="rodape-links">
        <a href="https://instagram.com/SEU_USUARIO" target="_blank" rel="noreferrer">Instagram</a>
        <a href="mailto:email@exemplo.com">Contato</a>
      </div>
      <small>© {new Date().getFullYear()} — Todos os direitos reservados</small>
    </footer>
  );
}