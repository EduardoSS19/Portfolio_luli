import { useEffect, useRef, useState } from 'react'

export function FundoFantasma({ frames }) {
  const [par, setPar] = useState({ atual: 0, anterior: null })
  const atualRef = useRef(0)

  useEffect(() => {
    let animationFrame = 0
    let limpeza = 0

    function atualizarIndice() {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        const alturaRolavel = document.documentElement.scrollHeight - window.innerHeight
        const progresso = alturaRolavel > 0 ? window.scrollY / alturaRolavel : 0
        const proximo = Math.round(progresso * Math.max(frames.length - 1, 0))
        if (proximo === atualRef.current) return

        const antigo = atualRef.current
        atualRef.current = proximo
        setPar({ atual: proximo, anterior: antigo })
        window.clearTimeout(limpeza)
        // O quadro antigo some depois do crossfade, então nunca há mais de 2 por painel.
        limpeza = window.setTimeout(() => setPar(p => ({ ...p, anterior: null })), 1300)
      })
    }

    atualizarIndice()
    window.addEventListener('scroll', atualizarIndice, { passive: true })
    window.addEventListener('resize', atualizarIndice)

    return () => {
      cancelAnimationFrame(animationFrame)
      window.clearTimeout(limpeza)
      window.removeEventListener('scroll', atualizarIndice)
      window.removeEventListener('resize', atualizarIndice)
    }
  }, [frames.length])

  useEffect(() => {
    // Pré-carrega os próximos quadros para a troca não piscar.
    if (!frames.length) return
    for (let passo = 1; passo <= 3; passo += 1) {
      const src = frames[(par.atual + passo + 2) % frames.length]
      if (src) new Image().src = src
    }
  }, [par.atual, frames])

  if (frames.length === 0) return null

  return (
    <div className="fundo-fantasma" aria-hidden="true">
      {[0, 1, 2].map(posicao => (
        <div className={`fundo-fantasma-painel painel-${posicao + 1}`} key={posicao}>
          {par.anterior !== null && par.anterior !== par.atual && (
            <div
              key={`saindo-${par.anterior}`}
              className="fundo-fantasma-frame saindo"
              style={{ '--imagem-fundo': `url("${frames[(par.anterior + posicao) % frames.length]}")` }}
            />
          )}
          <div
            key={`ativo-${par.atual}`}
            className="fundo-fantasma-frame ativo"
            style={{ '--imagem-fundo': `url("${frames[(par.atual + posicao) % frames.length]}")` }}
          />
        </div>
      ))}
    </div>
  )
}
