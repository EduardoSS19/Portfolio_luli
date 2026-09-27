import { useMemo } from 'react'

// Por enquanto, repetindo o mesmo frame de teste 6 vezes —
// quando tiver frames variados, troque cada linha por um arquivo diferente.
const basePublica = import.meta.env.BASE_URL
const frames = [
  `${basePublica}fundo/frame-01.png`,
  `${basePublica}fundo/frame-02.png`,
  `${basePublica}fundo/frame-03.png`,
  `${basePublica}fundo/frame-04.png`,
  `${basePublica}fundo/frame-05.png`,
  `${basePublica}fundo/frame-06.png`,
]

export function FundoFantasma({ secaoAtiva, secoes }) {
  const indice = useMemo(() => {
    const posicao = secoes.findIndex(s => s.titulo === secaoAtiva)
    return posicao === -1 ? 0 : posicao % frames.length
  }, [secaoAtiva, secoes])

  return (
    <div className="fundo-fantasma" aria-hidden="true">
      {frames.map((src, i) => (
        <img key={i} src={src} className={i === indice ? 'ativo' : ''} alt="" />
      ))}
    </div>
  )
}