// Compartilha IntersectionObservers entre cards que usam as mesmas opções.
// Mantém callbacks individuais por elemento, sem alterar os critérios de visibilidade.
const pools = new Map()

function chaveDasOpcoes({ rootMargin = '0px', threshold = 0 } = {}) {
  const thresholds = Array.isArray(threshold) ? threshold : [threshold]
  return JSON.stringify({ rootMargin, threshold: thresholds })
}

export function observarIntersecao(elemento, callback, opcoes = {}) {
  if (!elemento || typeof IntersectionObserver === 'undefined') return () => {}

  const chave = chaveDasOpcoes(opcoes)
  let pool = pools.get(chave)

  if (!pool) {
    pool = {
      observador: new IntersectionObserver(entradas => {
        entradas.forEach(entrada => pool.callbacks.get(entrada.target)?.(entrada))
      }, opcoes),
      callbacks: new Map(),
    }
    pools.set(chave, pool)
  }

  pool.callbacks.set(elemento, callback)
  pool.observador.observe(elemento)

  return () => {
    pool.callbacks.delete(elemento)
    pool.observador.unobserve(elemento)

    if (pool.callbacks.size === 0) {
      pool.observador.disconnect()
      pools.delete(chave)
    }
  }
}
