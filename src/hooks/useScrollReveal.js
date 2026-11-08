import { useEffect, useRef, useState } from 'react'
import { observarIntersecao } from './observarIntersecao.js'

// Mantém a visibilidade sincronizada com o viewport. Ao sair, remove a classe;
// ao retornar, adiciona novamente e reinicia a animação de entrada.
export function useScrollReveal(threshold = 0, rootMargin = '0px 0px -8% 0px') {
  const ref = useRef(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const elemento = ref.current
    if (!elemento) return

    return observarIntersecao(
      elemento,
      entrada => setVisivel(entrada.isIntersecting && entrada.intersectionRatio >= threshold),
      { threshold, rootMargin },
    )
  }, [threshold, rootMargin])

  return [ref, visivel]
}
