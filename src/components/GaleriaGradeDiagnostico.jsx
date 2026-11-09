import { useState } from 'react'
import './GaleriaGradeDiagnostico.css'

function obterMidias(obra) {
  const midias = Array.isArray(obra.midias) && obra.midias.length
    ? obra.midias
    : (Array.isArray(obra.imagens) && obra.imagens.length
      ? obra.imagens
      : obra.imagem ? [obra.imagem] : [])
  return midias.map(item => typeof item === 'string' ? { tipo: 'imagem', src: item } : item)
}

function urlMidia(midia) {
  if (midia?.tipo === 'youtube') {
    return midia.miniatura || (midia.videoId
      ? `https://i.ytimg.com/vi/${encodeURIComponent(midia.videoId)}/hqdefault.jpg`
      : '')
  }
  return typeof midia?.src === 'string'
    ? midia.src.replace('/upload/f_auto,q_auto,w_1400/', '/upload/f_auto,q_auto,w_640/')
    : ''
}

function CartaoDiagnostico({ obra, categoria }) {
  const [estado, setEstado] = useState('Carregando imagem…')
  const midias = obterMidias(obra)
  const midia = midias.find(item => item?.tipo === 'imagem' && item.src) || midias[0]
  const src = midia ? urlMidia(midia) : ''

  return (
    <article className="grade-diagnostico-card">
      <div className="grade-diagnostico-media">
        {src ? (
          <img
            src={src}
            alt={obra.titulo || 'Obra sem título'}
            loading="lazy"
            decoding="async"
            onLoad={event => {
              const img = event.currentTarget
              setEstado(`OK · ${img.naturalWidth} × ${img.naturalHeight}`)
            }}
            onError={() => setEstado('ERRO ao carregar imagem')}
          />
        ) : (
          <div className="grade-diagnostico-sem-imagem">
            {midia?.tipo === 'youtube' ? 'Miniatura de vídeo indisponível' : 'Esta obra não tem imagem cadastrada'}
          </div>
        )}
      </div>
      <div className="grade-diagnostico-info">
        <strong>{obra.titulo || 'Obra sem título'}</strong>
        <span>{categoria}</span>
        <small>{estado}</small>
      </div>
    </article>
  )
}

export function GaleriaGradeDiagnostico({ categorias }) {
  const total = categorias.reduce((soma, categoria) => soma + (categoria.obras?.length || 0), 0)

  return (
    <main className="grade-diagnostico">
      <header className="grade-diagnostico-header">
        <p>TESTE DE COMPATIBILIDADE</p>
        <h1>Grade experimental</h1>
        <span>{total} obras · estrutura HTML/CSS simplificada</span>
        <a href={window.location.pathname}>Voltar ao portfólio</a>
      </header>
      <section className="grade-diagnostico-grid" aria-label="Grade experimental de obras">
        {categorias.flatMap(categoria =>
          (categoria.obras || []).map((obra, indice) => (
            <CartaoDiagnostico
              key={`${categoria.chave}-${obra.titulo || indice}`}
              obra={obra}
              categoria={categoria.titulo}
            />
          )),
        )}
      </section>
    </main>
  )
}
