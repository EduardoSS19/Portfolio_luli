import { useEffect, useRef, useState } from 'react'

export function useScrollReveal(threshold = 0) {
  const ref = useRef(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const elemento = ref.current
    if (!elemento) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisivel(entry.isIntersecting)
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    )

    observer.observe(elemento)
    return () => observer.disconnect()
  }, [threshold])

  return [ref, visivel]
}