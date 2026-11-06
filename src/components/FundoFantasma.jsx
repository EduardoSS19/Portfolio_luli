import { useEffect, useState } from 'react'

export function FundoFantasma({ frames }) {
  const [indice, setIndice] = useState(0)

  useEffect(() => {
    let animationFrame = 0

    function atualizarIndice() {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        const alturaRolavel = document.documentElement.scrollHeight - window.innerHeight
        const progresso = alturaRolavel > 0 ? window.scrollY / alturaRolavel : 0
        const proximoIndice = Math.round(progresso * Math.max(frames.length - 1, 0))
        setIndice(indiceAtual => indiceAtual === proximoIndice ? indiceAtual : proximoIndice)
      })
    }

    atualizarIndice()
    window.addEventListener('scroll', atualizarIndice, { passive: true })
    window.addEventListener('resize', atualizarIndice)

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('scroll', atualizarIndice)
      window.removeEventListener('resize', atualizarIndice)
    }
  }, [frames.length])

  if (frames.length === 0) return null

  return (
    <div className="fundo-fantasma" aria-hidden="true">
      {[0, 1, 2].map(position => {
        const indiceAtivo = (indice + position) % frames.length

        return (
          <div className={`fundo-fantasma-painel painel-${position + 1}`} key={position}>
            {frames.map((src, index) => (
              <div
                key={src}
                className={`fundo-fantasma-frame ${index === indiceAtivo ? 'ativo' : ''}`}
                style={{ '--imagem-fundo': `url("${src}")` }}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}