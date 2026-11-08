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

    const atualizarSecaoAtiva = () => {
      const centro = window.innerHeight / 2
      const limiteSuperior = 160
      const limiteInferior = window.innerHeight - 160
      const candidatas = [...elementos.entries()]
        .map(([elemento, titulo]) => ({
          titulo,
          rect: elemento.getBoundingClientRect(),
        }))
        .filter(({ rect }) => rect.bottom > limiteSuperior && rect.top < limiteInferior)
        .sort((a, b) =>
          Math.abs((a.rect.top + a.rect.height / 2) - centro)
          - Math.abs((b.rect.top + b.rect.height / 2) - centro)
        )

      if (candidatas.length) setAtiva(candidatas[0].titulo)
    }

    const observer = new IntersectionObserver(atualizarSecaoAtiva, {
      threshold: 0,
      rootMargin: '-160px 0px -160px 0px',
    })

    elementos.forEach((_, elemento) => observer.observe(elemento))
    window.addEventListener('scroll', atualizarSecaoAtiva, { passive: true })
    window.addEventListener('resize', atualizarSecaoAtiva)

    // Recalcula após a montagem para não depender apenas da primeira leva
    // de entries do IntersectionObserver, que pode conter posições antigas.
    atualizarSecaoAtiva()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', atualizarSecaoAtiva)
      window.removeEventListener('resize', atualizarSecaoAtiva)
    }
  }, [categorias, modoGaleria])

  return [ativa, setAtiva]
}
