import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import qrcode from 'qrcode'
import { setSock, setQR, setConnection } from './state.js'
import fs from 'fs'
import { Boom } from '@hapi/boom'

let isConnecting = false

export async function connectToWhatsApp(onIncomingMessage) {
  if (isConnecting) return
  isConnecting = true

  const { state, saveCreds } = await useMultiFileAuthState('./session')

  const sock = makeWASocket({
    printQRInTerminal: false,
    auth: state
  })

  setSock(sock)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      const qrBase64 = await qrcode.toDataURL(qr)
      setQR(qrBase64)
      setConnection(false)
      console.log('🔄 Nuevo QR generado')
    }

    if (connection === 'open') {
      setQR(null)
      setConnection(true)
      console.log('✅ WhatsApp conectado')
      isConnecting = false
    }

    if (connection === 'close') {
      setConnection(false)

      const error = lastDisconnect?.error
      const statusCode = new Boom(error)?.output?.statusCode

      console.log('Socket cerrado. Código:', statusCode)

      // 🔴 Logout real
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('🚪 Logout detectado')

        if (fs.existsSync('./session')) {
          fs.rmSync('./session', { recursive: true, force: true })
        }

        try {
          sock.ev.removeAllListeners()
          sock.ws.close()
        } catch {}

        setSock(null)
        setQR(null)
        isConnecting = false
      }

      // 🔁 Reconexión limpia (incluye 515)
      console.log('🔁 Reconexión limpia en 4s...')

      try {
        sock.ev.removeAllListeners()
        sock.ws.close()
      } catch {}

      setSock(null)
      isConnecting = false

      setTimeout(() => {
        connectToWhatsApp(onIncomingMessage)
      }, 4000)
    }
  })

  sock.ev.on('creds.update', async () => {
     console.log('💾 Guardando credenciales...')
    await saveCreds()
  })

  sock.ev.on('messages.upsert', (msg) => {
    if (onIncomingMessage) onIncomingMessage(msg)
  })
}
