import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'

// Track the visible viewport height (shrinks when the iOS keyboard opens) so
// bottom-anchored overlays (drawers, popups) can resize above the keyboard.
if (typeof window !== 'undefined' && window.visualViewport) {
  const setVvh = () => {
    const vv = window.visualViewport!;
    document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
    document.documentElement.style.setProperty('--vv-offset', `${vv.offsetTop}px`);
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
