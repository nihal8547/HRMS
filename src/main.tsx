import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { PermissionProvider } from './contexts/PermissionContext'
import './index.css'
import './styles/design-system.css'
import './styles/table-overrides.css'
import './styles/mobile.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PermissionProvider>
      <App />
    </PermissionProvider>
  </React.StrictMode>,
)







