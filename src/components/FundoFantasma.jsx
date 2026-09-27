import { useMemo } from 'react'

export function FundoFantasma({ frames, secaoAtiva, secoes }) {
  const indice = useMemo(() => {
    if (frames.length === 0) return -1
    const posicao = secoes.findIndex(s => s.titulo === secaoAtiva)
    return posicao === -1 ? 0 : posicao % frames.length
  }, [frames.length, secaoAtiva, secoes])

  if (frames.length === 0) return null

  return (
    <div className="fundo-fantasma" aria-hidden="true">
      {frames.map((src, index) => (
        <img key={src} src={src} className={index === indice ? 'ativo' : ''} alt="" />
      ))}
    </div>
  )
}