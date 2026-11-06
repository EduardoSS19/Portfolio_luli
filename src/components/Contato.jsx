import { useState } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal.js'

export function Contato({ endpoint, email }) {
  const [enviando, setEnviando] = useState(false)
  const [status, setStatus] = useState(null)
  const [ref, visivel] = useScrollReveal()

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

  return (
    <section ref={ref} id="Contato" className={`secao secao-contato ${visivel ? 'visivel' : ''}`}>
      <header className="secao-cabecalho">
        <span className="secao-indice">VAMOS CONVERSAR</span>
        <h2>Contato</h2>
      </header>
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
      </form> : email ? (
        <div className="contato-chamada">
          <p>Para projetos, perguntas ou uma boa conversa sobre arte:</p>
          <a className="contato-email" href={`mailto:${email}`}>{email}</a>
        </div>
      ) : (
        <p className="contato-indisponivel">
          As informações de contato serão adicionadas em breve. Você pode falar comigo pelas redes sociais abaixo.
        </p>
      )}
    </section>
  )
}