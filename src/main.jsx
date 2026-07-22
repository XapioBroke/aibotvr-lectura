import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ModoDemoLectura from './ModoDemoLectura.jsx'

import { initializeApp, getApps } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously, signOut } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyCPn0kMMrx4tRW1XJfrTenqPB08XzAc1x0",
  authDomain: "aibotvr1.firebaseapp.com",
  projectId: "aibotvr1",
  storageBucket: "aibotvr1.firebasestorage.app",
  messagingSenderId: "524453697028",
  appId: "1:524453697028:web:08d175b825238dbf590751"
}

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const auth = getAuth(firebaseApp)

function getRol(user) {
  if (!user) return null
  if (user.isAnonymous) return localStorage.getItem('iapprende_rol') || 'invitado'
  if (user.email?.endsWith('@jaliscoedu.mx')) return 'docente'
  return 'invitado'
}

const root = createRoot(document.getElementById('root'))

root.render(
  <div style={{
    display:'flex', alignItems:'center', justifyContent:'center',
    height:'100vh', background:'#050c1a', color:'#fff',
    fontFamily:'Georgia, serif', fontSize:'18px', gap:'12px'
  }}>
    <span style={{ fontSize:28 }}>📖</span> Cargando Lectura con IA...
  </div>
)

const handleSalir = async () => {
  await signOut(auth)
  ;['iapprende_rol','iapprende_codigo','iapprende_grupo','iapprende_escuela','iapprende_proyecto']
    .forEach(k => localStorage.removeItem(k))
  window.location.replace('https://iapprende.com')
}

async function init() {
  const params  = new URLSearchParams(window.location.search)
  const token   = params.get('token')
  const rol     = params.get('rol')
  const grupo   = params.get('grupo')
  const escuela = params.get('escuela')

  if (rol)     localStorage.setItem('iapprende_rol', rol)
  if (grupo)   localStorage.setItem('iapprende_grupo', grupo)
  if (escuela) localStorage.setItem('iapprende_escuela', escuela)

  if (params.toString()) {
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  if (token) {
    try {
      await signInWithCustomToken(auth, token)
    } catch(e) {
      console.warn('Error custom token:', e.message)
      window.location.replace('https://iapprende.com')
      return
    }
  } else if (rol === 'alumno' || rol === 'invitado') {
    try {
      await signInAnonymously(auth)
    } catch(e) {
      console.warn('Error sesión anónima:', e.message)
      window.location.replace('https://iapprende.com')
      return
    }
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace('https://iapprende.com')
      return
    }

    const rolEfectivo = getRol(user)

    if (rolEfectivo === 'alumno' || rolEfectivo === 'invitado') {
      // Alumno e invitado → modo demo de lectura
      root.render(
        <StrictMode>
          <ModoDemoLectura rol={rolEfectivo} onSalir={handleSalir} />
        </StrictMode>
      )
    } else {
      // Docente → App original completa sin cambios
      root.render(
        <StrictMode>
          <App />
        </StrictMode>
      )
    }
  })
}

init()
