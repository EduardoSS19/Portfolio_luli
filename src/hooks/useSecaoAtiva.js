import { useEffect, useState } from 'react'

// Detecta qual seção está passando pelo "meio" da tela.
// Em navegadores sem IntersectionObserver, mantém uma navegação funcional
// usando a primeira seção como fallback, sem impedir a renderização do site.
export function useSecaoAtiva(categorias) {
  const [ativa, setAtiva] = useState(categorias[0]?.titulo)

  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') {
      setAtiva(categorias[0]?.titulo)
      return
    }

    const elementos = categorias
      .map(cat => document.getElementById(cat.titulo))
      .filter(Boolean)

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setAtiva(entry.target.id)
          }
        })
      },
      { threshold: 0, rootMargin: '-45% 0px -45% 0px' }
    )

    elementos.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [categorias])

  return ativa
}
