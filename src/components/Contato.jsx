import { useState } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal.js'
import { trackAnalyticsEvent } from '../utils/analytics.js'

function lerCookie(nome) {
  const cookie = document.cookie
    .split('; ')
    .find(parte => parte.startsWith(`${nome}=`))
  return cookie ? decodeURIComponent(cookie.slice(nome.length + 1)) : ''
}

export function Contato({ endpoint, email }) {
  const [enviando, setEnviando] = useState(false)
  const [status, setStatus] = useState(null)
  const [ref, visivel] = useScrollReveal()

  async function lidarEnvio(e) {
    e.preventDefault()
    setEnviando(true)
    setStatus(null)

    const formulario = e.currentTarget
    const dados = new FormData(formulario)
    const usarApiDoPortfolio = Boolean(email)

    try {
      const resposta = await fetch(usarApiDoPortfolio ? '/api/contact/' : endpoint, {
        method: 'POST',
        body: usarApiDoPortfolio
          ? JSON.stringify(Object.fromEntries(dados.entries()))
          : dados,
        headers: {
          Accept: 'application/json',
          ...(usarApiDoPortfolio
            ? {
                'Content-Type': 'application/json',
                'X-CSRFToken': lerCookie('csrftoken'),
              }
            : {}),
        },
      })
      if (resposta.ok) {
        trackAnalyticsEvent('generate_lead', { method: 'contact_form' })
        setStatus('sucesso')
        formulario.reset()
      } else {
        setStatus('erro')
      }
    } catch {
      setStatus('erro')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section ref={ref} id="Contato" className={`secao secao-contato ${visivel ? 'visivel' : ''}`}>
      <header className="secao-cabecalho">
        <span className="secao-indice">VAMOS CONVERSAR</span>
        <h2>Contato</h2>
      </header>
      <form className="form-contato" onSubmit={lidarEnvio}>
        <label>
          Nome
          <input type="text" name="nome" maxLength="120" autoComplete="name" required />
        </label>
        <label>
          E-mail
          <input type="email" name="email" maxLength="254" autoComplete="email" required />
        </label>
        <label>
          Assunto
          <input type="text" name="assunto" maxLength="160" />
        </label>
        <label>
          Mensagem
          <textarea name="mensagem" rows="5" maxLength="10000" required />
        </label>
        <div className="campo-isca" aria-hidden="true">
          <label>
            Site
            <input type="text" name="website" tabIndex="-1" autoComplete="off" />
          </label>
        </div>
        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar mensagem'}
        </button>
        {status === 'sucesso' && <p className="form-status sucesso" role="status">Mensagem enviada! Obrigada pelo contato.</p>}
        {status === 'erro' && <p className="form-status erro" role="alert">Não foi possível enviar agora. Tente novamente mais tarde.</p>}
      </form>
    </section>
  )
}