import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'



window.onerror = function (msg, url, line, col, error) {
  console.error("Global Error Detected:", msg, error);
  document.body.innerHTML = `<div style="color:red; padding:20px;"><h1>Critical Error</h1><p>${msg}</p><pre>${error?.stack}</pre></div>`;
};

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (e) {
  console.error("React Mount Error:", e);
  document.body.innerHTML = `<div style="color:red; padding:20px;"><h1>Mount Error</h1><p>${e.message}</p></div>`;
}
