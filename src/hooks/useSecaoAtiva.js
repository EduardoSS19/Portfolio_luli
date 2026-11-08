import { useEffect, useState } from 'react'

// Detecta qual seção está passando pelo "meio" da tela.
// Na visualização em grade, observa os cards individuais de cada categoria.
export function useSecaoAtiva(categorias, modoGaleria = 'lista') {
  const [ativa, setAtiva] = useState(categorias[0]?.titulo)

  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') {
      setAtiva(categorias[0]?.titulo)
      return
    }

    const elementos = new Map()
    const gradeGlobal = modoGaleria === 'grade'
      ? document.querySelector('.galeria-grade-global')
      : null

    categorias.forEach(categoria => {
      const secao = document.getElementById(categoria.titulo)
      if (secao) {
        elementos.set(secao, categoria.titulo)
        return
      }

      // Na grade global não existem seções separadas: cada card continua
      // associado à categoria original para manter a navegação sincronizada.
      if (!gradeGlobal) return
      gradeGlobal.querySelectorAll('.obra').forEach(card => {
        if (card.classList.contains(`categoria-${categoria.chave}`)) {
          elementos.set(card, categoria.titulo)
        }
      })
    })

    const observer = new IntersectionObserver(
      entries => {
        // Usa a entrada mais próxima do centro da viewport quando várias
        // obras da mesma/diferentes categorias intersectam a faixa central.
        const visiveis = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top + a.boundingClientRect.height / 2 - window.innerHeight / 2)
            - Math.abs(b.boundingClientRect.top + b.boundingClientRect.height / 2 - window.innerHeight / 2))

        if (visiveis.length) {
          const titulo = elementos.get(visiveis[0].target)
          if (titulo) setAtiva(titulo)
        }
      },
      { threshold: 0, rootMargin: '-160px 0px -160px 0px' }
    )

    elementos.forEach((_, elemento) => observer.observe(elemento))
    return () => observer.disconnect()
  }, [categorias, modoGaleria])

  return ativa
}
