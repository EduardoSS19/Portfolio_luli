import { useEffect, useRef, useState } from 'react'

// Mantém a visibilidade sincronizada com o viewport. Ao sair, remove a classe;
// ao retornar, adiciona novamente e reinicia a animação de entrada.
export function useScrollReveal(threshold = 0, rootMargin = '0px 0px -8% 0px') {
  const ref = useRef(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const elemento = ref.current
    if (!elemento) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisivel(entry.isIntersecting && entry.intersectionRatio >= threshold)
      },
      { threshold, rootMargin }
    )

    observer.observe(elemento)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  return [ref, visivel]
}
