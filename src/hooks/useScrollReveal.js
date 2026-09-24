import { useEffect, useRef, useState } from 'react'

// Encapsula a lógica de "esse elemento já entrou na tela?".
// Qualquer componente pode reutilizar isso sem repetir a lógica de Observer.
export function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const elemento = ref.current
    if (!elemento) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisivel(true)
          observer.unobserve(elemento) // revela uma vez só
        }
      },
      { threshold }
    )

    observer.observe(elemento)
    return () => observer.disconnect() // cleanup, evita vazamento de memória
  }, [threshold])

  return [ref, visivel]
}
