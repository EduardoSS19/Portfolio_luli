import { useEffect, useRef, useState } from 'react'

// Marca o elemento como visível na primeira vez que ele entra na tela e para de observar.
// Antes, as animações de entrada rodavam de novo a cada vez que o card saía e voltava,
// o que pesava muito durante a rolagem.
export function useScrollReveal(threshold = 0) {
  const ref = useRef(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const elemento = ref.current
    if (!elemento) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisivel(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    )

    observer.observe(elemento)
    return () => observer.disconnect()
  }, [threshold])

  return [ref, visivel]
}
