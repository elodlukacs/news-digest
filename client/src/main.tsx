import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { installApiFetch } from './lib/apiFetch'

// Must run before any component mounts: adds the API bearer token (when
// configured) and converts HTML-instead-of-JSON API responses into a clear error.
installApiFetch()

// Track the visible viewport height (shrinks when the iOS keyboard opens) so
// bottom-anchored overlays (drawers, popups) can resize above the keyboard.
if (typeof window !== 'undefined' && window.visualViewport) {
  const setVvh = () => {
    const vv = window.visualViewport!;
    const kbd = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
    document.documentElement.style.setProperty('--kbd', `${kbd}px`);
  };
  setVvh();
  window.visualViewport.addEventListener('resize', setVvh);
  window.visualViewport.addEventListener('scroll', setVvh);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
