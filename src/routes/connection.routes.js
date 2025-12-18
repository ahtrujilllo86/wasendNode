import express from 'express'
import { qrCodeData, isConnected } from '../whatsapp/state.js'

const router = express.Router()

// Estado / QR
router.get('/qr', (req, res) => {
  res.json({
    qr: qrCodeData,
    connected: isConnected
  })
})

// 🧾 Página principal con QR + formulario
router.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>WhatsApp Control Panel</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
          h1, h2 { text-align: center; color: #333; }
          #qr-container { text-align: center; margin-bottom: 30px; }
          img { border-radius: 12px; border: 8px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.2); }
          form { max-width: 400px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          input, textarea, button { width: 100%; padding: 10px; margin-top: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 16px; }
          button { background: #25d366; color: white; border: none; font-weight: bold; cursor: pointer; }
          button:hover { background: #1ebe5d; }
          #status { text-align: center; margin-top: 15px; color: #555; }
        </style>
      </head>
      <body>
        <h1>WhatsApp Web Control</h1>
        <div id="qr-container"><p>Cargando QR...</p></div>
        <h2>Enviar mensaje</h2>
        <form id="sendForm">
          <input type="text" id="number" placeholder="Número (ej. 5215555555555)" required />
          <textarea id="message" placeholder="Escribe tu mensaje..." required></textarea>
          <button type="submit">Enviar mensaje</button>
        </form>
        <div id="status"></div>
        <script>
          async function updateQR() {
            const res = await fetch('/connection/qr')
            const data = await res.json()
            const container = document.getElementById('qr-container')

            if (data.qr) {
              container.innerHTML = '<img src="' + data.qr + '" width="300" />'
            } else if (data.connected) {
              container.innerHTML = '<h3>✅ Ya estás conectado a WhatsApp</h3>'
            } else {
              container.innerHTML = '<p>Esperando QR...</p>'
            }
          }

          updateQR()
          setInterval(updateQR, 2000)

          // Enviar mensaje
          const form = document.getElementById('sendForm')
          const statusDiv = document.getElementById('status')
          form.addEventListener('submit', async (e) => {
            e.preventDefault()
            const number = document.getElementById('number').value
            const message = document.getElementById('message').value
            statusDiv.textContent = 'Enviando mensaje...'
            try {
              const res = await fetch('/send', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ number, message })
              })
              const data = await res.json()
              if (data.success) {
                statusDiv.textContent = '✅ Mensaje enviado correctamente a ' + number
                form.reset()
              } else {
                statusDiv.textContent = '❌ Error al enviar mensaje'
              }
            } catch {
              statusDiv.textContent = '⚠️ No se pudo conectar al servidor'
            }
          })
        </script>
      </body>
    </html>
  `)
})

export default router
