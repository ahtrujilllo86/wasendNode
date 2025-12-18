import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import qrcode from 'qrcode'
import { setSock, setQR, setConnection } from './state.js'

export async function connectToWhatsApp(onIncomingMessage) {
  const { state, saveCreds } = await useMultiFileAuthState('./session')

  const sock = makeWASocket({
    printQRInTerminal: false,
    auth: state
  })

  setSock(sock)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      setQR(await qrcode.toDataURL(qr))
      setConnection(false)
      console.log('🔄 Nuevo QR')
    }

    if (connection === 'open') {
      setQR(null)
      setConnection(true)
      console.log('✅ WhatsApp conectado')
    }

    if (connection === 'close') {
      setConnection(false)
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

      if (shouldReconnect) {
        console.log('⚠️ Reconectando...')
        connectToWhatsApp(onIncomingMessage)
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', (msg) => {
    if (onIncomingMessage) onIncomingMessage(msg)
  })
}
