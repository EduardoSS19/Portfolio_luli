import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { initializeAnalytics } from './utils/analytics.js'

// O snippet do Google Tag Manager já foi inicializado no HTML, antes do React.
initializeAnalytics()

// O modo leve depende de sinais diretamente relacionados a desempenho/conforto.
// Não usamos suporte a uma propriedade CSS (overflow: clip) como proxy de Safari antigo:
// cada recurso visual tem seu próprio fallback em CSS.
try {
  const parametros = new URLSearchParams(window.location.search)
  const poucaMemoria = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2
  const poucosNucleos = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2
  if (parametros.has('leve') || poucaMemoria || poucosNucleos) {
    document.documentElement.classList.add('modo-leve')
  }
} catch {
  // Se uma API opcional não estiver disponível, o conteúdo continua funcionando.
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
