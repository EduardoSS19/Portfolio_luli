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

    const elementos = new Map()
    categorias.forEach(categoria => {
      const secao = document.getElementById(categoria.titulo)
      if (secao) {
        elementos.set(secao, categoria.titulo)
        return
      }
      // Na grade global não existem seções separadas: cada card continua
      // associado à categoria original para manter a navegação sincronizada.
      if (!document.querySelector('.galeria-grade-global')) return
      document.querySelectorAll('.galeria-grade-global .obra').forEach(card => {
        if (card.classList.contains(`categoria-${categoria.chave}`)) {
          elementos.set(card, categoria.titulo)
        }
      })
    })

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setAtiva(elementos.get(entry.target))
        })
      },
      { threshold: 0, rootMargin: '-45% 0px -45% 0px' }
    )

    elementos.forEach((_, elemento) => observer.observe(elemento))
    return () => observer.disconnect()
  }, [categorias])

  return ativa
}
