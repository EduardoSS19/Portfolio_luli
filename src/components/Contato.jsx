import { useState } from 'react'

export function Contato({ endpoint, email }) {
  const [enviando, setEnviando] = useState(false)
  const [status, setStatus] = useState(null)

  async function lidarEnvio(e) {
    e.preventDefault()
    setEnviando(true)
    setStatus(null)

    const dados = new FormData(e.target)

    try {
      const resposta = await fetch(endpoint, {
        method: 'POST',
        body: dados,
        headers: { Accept: 'application/json' },
      })
      if (resposta.ok) {
        setStatus('sucesso')
        e.target.reset()
      } else {
        setStatus('erro')
      }
    } catch {
      setStatus('erro')
    } finally {
      setEnviando(false)
    }
  }

  if (!endpoint && !email) return null

  return (
    <section id="Contato" className="secao">
      <h2>Contato</h2>
      {endpoint ? <form className="form-contato" onSubmit={lidarEnvio}>
        <label>
          Nome
          <input type="text" name="nome" required />
        </label>
        <label>
          E-mail
          <input type="email" name="email" required />
        </label>
        <label>
          Mensagem
          <textarea name="mensagem" rows="5" required />
        </label>
        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar mensagem'}
        </button>
        {status === 'sucesso' && <p className="form-status sucesso">Mensagem enviada! Obrigada pelo contato.</p>}
        {status === 'erro' && <p className="form-status erro">Algo deu errado — tente novamente.</p>}
      </form> : <a className="contato-email" href={`mailto:${email}`}>{email}</a>}
    </section>
  )
}