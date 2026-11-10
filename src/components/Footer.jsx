import { trackAnalyticsEvent } from '../utils/analytics.js'

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
          <a key={`${rede.url}-${indice}`} href={rede.url} target="_blank" rel="noreferrer" onClick={() => trackAnalyticsEvent('outbound_click', { link_label: rede.titulo })}>
            {rede.titulo}
          </a>
        ))}
        {email && <a href={`mailto:${email}`} onClick={() => trackAnalyticsEvent('contact_click', { contact_method: 'email' })}>Contato</a>}
      </div>
      <small>© {new Date().getFullYear()} — Todos os direitos reservados</small>
      <div className="rodape-creditos">
        <span>Desenvolvido por <strong>Eduardo Souza</strong></span>
        <a className="rodape-contato-dev" href="mailto:leduardoss19@gmail.com">Contato do desenvolvedor</a>
      </div>
    </footer>
  );
}