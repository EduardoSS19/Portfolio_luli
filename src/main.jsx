import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'

// "Modo leve": navegadores antigos (como Safari anterior ao 16) ganham uma versão com
// menos efeitos. Para testar em qualquer navegador, abra o site com ?leve no endereço.
try {
  const antigo = !(window.CSS && CSS.supports && CSS.supports('overflow: clip'))
  const forcado = new URLSearchParams(window.location.search).has('leve')
  const poucaMemoria = navigator.deviceMemory && navigator.deviceMemory <= 2
  if (antigo || forcado || poucaMemoria) document.documentElement.classList.add('modo-leve')
} catch {
  /* sem problema: segue com a versão completa */
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
