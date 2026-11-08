import { useEffect, useRef, useState } from 'react'
import { observarIntersecao } from './observarIntersecao.js'

// Mantém a visibilidade sincronizada com o viewport. O modo "once" mantém
// a classe após a primeira entrada, evitando reiniciar animações ao voltar.
export function useScrollReveal(threshold = 0, rootMargin = '0px 0px -8% 0px', { once = false } = {}) {
  const ref = useRef(null)
  const jaRevelado = useRef(false)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const elemento = ref.current
    if (!elemento) return

    return observarIntersecao(
      elemento,
      entrada => {
        const entrou = entrada.isIntersecting && entrada.intersectionRatio >= threshold
        if (once) {
          if (entrou && !jaRevelado.current) {
            jaRevelado.current = true
            setVisivel(true)
          }
          return
        }
        setVisivel(entrou)
      },
      { threshold, rootMargin },
    )
  }, [threshold, rootMargin, once])

  return [ref, visivel]
}
