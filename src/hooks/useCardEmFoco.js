import { useEffect, useState } from 'react'
import { observarIntersecao } from './observarIntersecao.js'

// Devolve true enquanto o elemento está cruzando a faixa central da tela.
// A faixa é fina (10% da altura), então só o card do meio fica "em foco".
export function useCardEmFoco(ref) {
  const [emFoco, setEmFoco] = useState(false)

  useEffect(() => {
    const elemento = ref.current
    if (!elemento) return undefined

    return observarIntersecao(
      elemento,
      entrada => setEmFoco(entrada.isIntersecting),
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
  }, [ref])

  return emFoco
}
