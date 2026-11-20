import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { App } from './app/App'
import './styles/base.css'
import './components/components.css'

// A rebuild while the tab is open deletes the old lazy chunks; reload once to pick up the new index.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('perfagent:reloaded')) return
    sessionStorage.setItem('perfagent:reloaded', '1')
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})
window.addEventListener('load', () => {
  // Clear the guard once a page loaded fine, so the next update can reload again.
  setTimeout(() => {
    try {
      sessionStorage.removeItem('perfagent:reloaded')
    } catch {
      // storage blocked: the guard just stays off
    }
  }, 10_000)
})

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
