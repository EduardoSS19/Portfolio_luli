import { useEffect, useRef, useState } from 'react'

export function useFrameScroll(totalFrames) {
  const containerRef = useRef(null)
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    let ticking = false

    function calcular() {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const alturaRolavel = el.offsetHeight - window.innerHeight
      if (alturaRolavel <= 0) return

      const progresso = Math.min(Math.max(-rect.top / alturaRolavel, 0), 1)
      const indice = Math.min(totalFrames - 1, Math.floor(progresso * totalFrames))
      setFrame(indice)
      ticking = false
    }

    function aoRolar() {
      if (!ticking) {
        requestAnimationFrame(calcular)
        ticking = true
      }
    }

    window.addEventListener('scroll', aoRolar, { passive: true })
    calcular()
    return () => window.removeEventListener('scroll', aoRolar)
  }, [totalFrames])

  return [containerRef, frame]
}