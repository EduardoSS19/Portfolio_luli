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

  useEffect(() => {
    // Pré-carrega os próximos quadros para a troca não piscar.
    for (let passo = 1; passo <= 3; passo += 1) {
      const src = frames[(indice + passo + 2) % frames.length]
      if (src) new Image().src = src
    }
  }, [indice, frames])

  if (frames.length === 0) return null

  return (
    <div className="fundo-fantasma" aria-hidden="true">
      {[0, 1, 2].map(position => {
        const indiceAtivo = (indice + position) % frames.length

        return (
          <div className={`fundo-fantasma-painel painel-${position + 1}`} key={position}>
            <div
              key={frames[indiceAtivo]}
              className="fundo-fantasma-frame ativo"
              style={{ '--imagem-fundo': `url("${frames[indiceAtivo]}")` }}
            />
          </div>
        )
      })}
    </div>
  )
}