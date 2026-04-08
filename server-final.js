// server.js - Servidor proxy para API de Claude (TIER 1)
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3001;

const ANTHROPIC_API_KEY = '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';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── Almacén temporal de sesiones QR ──
const sesionesQR = {};

// ── QR MICRÓFONO — Ruta 1: página que abre el celular ──
app.get('/mic/:sesionId', (req, res) => {
  const { sesionId } = req.params;
  sesionesQR[sesionId] = { conectado: true, transcripcion: null, tiempo: null };
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Aura Core — Micrófono</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0e27; color: #fff; font-family: system-ui, sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
    h1 { font-size: 1.1rem; text-align: center; margin-bottom: 8px; color: #0a84ff; }
    p.sub { font-size: 0.85rem; color: #8e8e93; text-align: center; margin-bottom: 24px; line-height: 1.5; }
    #btn { width: 120px; height: 120px; border-radius: 50%; border: none; background: #0a84ff; color: #fff; font-size: 2.5rem; cursor: pointer; transition: transform 0.1s; box-shadow: 0 0 40px rgba(10,132,255,0.4); }
    #btn.grabando { background: #ff453a; box-shadow: 0 0 40px rgba(255,69,58,0.5); animation: pulse 1s infinite; }
    #btn:active { transform: scale(0.95); }
    #estado { margin-top: 20px; font-size: 0.9rem; font-weight: 600; min-height: 24px; text-align: center; }
    #timer { font-size: 2rem; font-weight: 700; margin-top: 12px; color: #ffd60a; min-height: 40px; }
    #resultado { margin-top: 20px; padding: 16px; background: rgba(48,209,88,0.1); border: 1px solid rgba(48,209,88,0.3); border-radius: 12px; font-size: 0.8rem; line-height: 1.5; color: rgba(255,255,255,0.8); display: none; max-height: 200px; overflow-y: auto; width: 100%; }
    @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
  </style>
</head>
<body>
  <h1>🎙️ Aura Core</h1>
  <p class="sub">Toca el botón para iniciar.<br>Tócalo de nuevo cuando termines.</p>
  <button id="btn" onclick="toggleGrabacion()">🎙️</button>
  <div id="estado">Listo para grabar</div>
  <div id="timer"></div>
  <div id="resultado"></div>
  <script>
    const SESION_ID = '${sesionId}';
    const SERVER = window.location.origin;
    // ── ESTRATEGIA: sesiones cortas encadenadas (sin continuous:true)
    // Cada sesión dura hasta que Chrome la termina (~5-10s)
    // Se encadenan automáticamente acumulando SOLO texto nuevo
    let grabando = false;
    let tiempoInicio = null;
    let timerInterval = null;
    let liveInterval = null;
    let textoAcumulado = ''; // texto final limpio, nunca se duplica
    let sesionActiva = null;

    function toggleGrabacion() {
      if (!grabando) iniciarGrabacion();
      else detenerGrabacion();
    }

    function iniciarSesionCorta() {
      if (!grabando) return;
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const r = new SR();
      // NO usar continuous:true — cada sesión es corta y limpia
      r.continuous = false;
      r.interimResults = true;
      r.lang = 'es-MX';
      r.maxAlternatives = 1;

      let textoSesion = ''; // solo lo de esta sesión

      r.onresult = (e) => {
        textoSesion = '';
        for (let i = 0; i < e.results.length; i++) {
          textoSesion += e.results[i][0].transcript;
        }
        // Mostrar acumulado + interim de esta sesión
        const total = (textoAcumulado + ' ' + textoSesion).trim();
        document.getElementById('resultado').style.display = 'block';
        document.getElementById('resultado').textContent = total;
      };

      r.onend = () => {
        // Agregar solo el texto de esta sesión al acumulado
        if (textoSesion.trim()) {
          textoAcumulado = (textoAcumulado + ' ' + textoSesion.trim()).trim();
          document.getElementById('resultado').textContent = textoAcumulado;
        }
        // Encadenar siguiente sesión automáticamente
        if (grabando) {
          setTimeout(() => iniciarSesionCorta(), 100);
        }
      };

      r.onerror = (e) => {
        if (e.error === 'no-speech') {
          // Normal — encadenar siguiente sesión
          if (grabando) setTimeout(() => iniciarSesionCorta(), 100);
          return;
        }
        if (e.error === 'aborted') return; // detención manual, ignorar
        console.error('mic error:', e.error);
        if (grabando) setTimeout(() => iniciarSesionCorta(), 500);
      };

      sesionActiva = r;
      try { r.start(); } catch(_) {}
    }

    function iniciarGrabacion() {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Usa Chrome en tu celular.');
        return;
      }
      textoAcumulado = '';
      sesionActiva = null;
      grabando = true;
      tiempoInicio = Date.now();

      document.getElementById('btn').className = 'grabando';
      document.getElementById('btn').textContent = '⏹';
      document.getElementById('estado').textContent = '🔴 Grabando...';
      document.getElementById('resultado').textContent = '';
      document.getElementById('resultado').style.display = 'block';

      // Iniciar primera sesión corta
      iniciarSesionCorta();

      // Timer visual
      timerInterval = setInterval(() => {
        const seg = Math.floor((Date.now() - tiempoInicio) / 1000);
        const m = Math.floor(seg / 60).toString().padStart(2, '0');
        const s = (seg % 60).toString().padStart(2, '0');
        document.getElementById('timer').textContent = m + ':' + s;
      }, 1000);

      // Avisar al servidor — activa fullscreen en la PC
      fetch(SERVER + '/api/mic-start/' + SESION_ID, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }
      }).catch(() => {});

      // Enviar texto acumulado en vivo cada 1s para tracker más fluido
      let ultimoEnviado = '';
      liveInterval = setInterval(() => {
        const textoActual = textoAcumulado.trim();
        // Solo enviar si hay texto nuevo desde el último envío
        if (textoActual && textoActual !== ultimoEnviado) {
          ultimoEnviado = textoActual;
          const seg = Math.floor((Date.now() - tiempoInicio) / 1000);
          fetch(SERVER + '/api/mic-live/' + SESION_ID, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcripcion: textoActual, tiempo: seg })
          }).catch(() => {});
        }
      }, 1000);
    }
    async function detenerGrabacion() {
      grabando = false; // primero — impide que onend encadene nueva sesión
      if (sesionActiva) { try { sesionActiva.stop(); } catch(_) {} sesionActiva = null; }
      clearInterval(timerInterval); clearInterval(liveInterval);
      const tiempo = Math.floor((Date.now() - tiempoInicio) / 1000);

      document.getElementById('btn').className = '';
      document.getElementById('btn').textContent = '✅';
      document.getElementById('estado').textContent = '⬆️ Enviando al PC...';
      document.getElementById('timer').textContent = '';

      // Pequeña espera para capturar el último fragmento del onend
      await new Promise(r => setTimeout(r, 400));
      const textoFinal = textoAcumulado.trim();

      try {
        await fetch(SERVER + '/api/mic-result/' + SESION_ID, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcripcion: textoFinal, tiempo })
        });
        document.getElementById('estado').textContent = '✅ ¡Listo! Regresa al PC';
        document.getElementById('btn').textContent = '✓';
      } catch(e) {
        document.getElementById('estado').textContent = '❌ Error. Intenta de nuevo.';
        document.getElementById('btn').textContent = '🎙️';
      }
    }
  </script>
</body>
</html>`);
});

// ── QR MICRÓFONO — Ruta 2: polling desde Aura (incluye transcripción en vivo) ──
app.get('/api/mic-status/:sesionId', (req, res) => {
  const sesion = sesionesQR[req.params.sesionId];
  if (!sesion) return res.json({ conectado: false, transcripcion: null });
  res.json({
    conectado:           sesion.conectado     || false,
    grabando:            sesion.grabando      || false,
    transcripcion:       sesion.transcripcion || null,  // final (al detener)
    transcripcionLive:   sesion.transcripcionLive || null, // en tiempo real
    tiempo:              sesion.tiempo        || null,
  });
});

// ── QR MICRÓFONO — Ruta 2b: el celular envía transcripción en vivo ──
app.post('/api/mic-live/:sesionId', (req, res) => {
  const { transcripcion, tiempo } = req.body;
  if (sesionesQR[req.params.sesionId]) {
    sesionesQR[req.params.sesionId].transcripcionLive = transcripcion;
    sesionesQR[req.params.sesionId].tiempo = tiempo;
  }
  res.json({ ok: true });
});

// ── QR MICRÓFONO — Ruta 3b: el celular avisa que INICIÓ grabación ──
app.post('/api/mic-start/:sesionId', (req, res) => {
  if (sesionesQR[req.params.sesionId]) {
    sesionesQR[req.params.sesionId].grabando = true;
  }
  res.json({ ok: true });
});

// ── QR MICRÓFONO — Ruta 3: el celular envía la transcripción ──
app.post('/api/mic-result/:sesionId', (req, res) => {
  const { transcripcion, tiempo } = req.body;
  sesionesQR[req.params.sesionId] = { conectado: true, transcripcion, tiempo };
  setTimeout(() => { delete sesionesQR[req.params.sesionId]; }, 5 * 60 * 1000);
  res.json({ ok: true });
});

// ── Análisis de lectura ──
app.post('/api/analizar-lectura', async (req, res) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    console.log('📥 Recibiendo solicitud de análisis...');
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'El prompt es requerido' });

    console.log('🤖 Procesando con Claude API...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: "Eres un sistema de evaluación de lectura. Tu ÚNICA salida permitida es un objeto JSON válido y estrictamente formateado. No escribas introducciones, no escribas conclusiones, no uses markdown de bloques de código. Solo JSON.",
        messages: [{ role: 'user', content: prompt }]
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Error de API de Claude:', errorData);
      return res.status(response.status).json({ error: `API Error: ${response.statusText}`, details: errorData });
    }

    const data = await response.json();
    console.log('✅ Respuesta exitosa generada por Claude');
    res.json(data);

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ Timeout.');
      return res.status(504).json({ error: 'Timeout — el texto era muy largo.' });
    }
    console.error('❌ Error crítico:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  } finally {
    clearTimeout(timeoutId);
  }
});

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor funcionando ⌚' });
});

// ── SERVIDOR: HTTPS si hay certificado, HTTP como fallback ──
const CERT_FILE = path.join(__dirname, '192.168.1.97+2.pem');
const KEY_FILE  = path.join(__dirname, '192.168.1.97+2-key.pem');

const tieneCert = fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE);

// HTTP siempre activo en 3001 para que la PC (localhost) funcione sin problemas
http.createServer(app).listen(3001, 'localhost', () => {
  console.log('  ✅ HTTP  → localhost:3001 (uso interno PC)');
});

if (tieneCert) {
  const sslOptions = {
    cert: fs.readFileSync(CERT_FILE),
    key:  fs.readFileSync(KEY_FILE),
  };
  // HTTPS en 3443 para el celular via red local
  https.createServer(sslOptions, app).listen(3443, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════╗
║  🚀 BACKEND TIER 1 ACTIVO             ║
║  🖥️  HTTP  → localhost:3001 (PC)      ║
║  📱 HTTPS → 192.168.1.97:3443 (QR)   ║
║  🔒 SSL: HABILITADO                   ║
╚════════════════════════════════════════╝
    `);
  });
} else {
  console.log(`
╔════════════════════════════════════════╗
║  🚀 BACKEND TIER 1 ACTIVO             ║
║  🖥️  HTTP  → localhost:3001 (PC)      ║
║  ⚠️  Sin SSL — ejecuta mkcert para QR ║
╚════════════════════════════════════════╝
  `);
}