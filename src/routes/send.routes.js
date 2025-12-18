import express from 'express'
import { sock, isConnected } from '../whatsapp/state.js'

const router = express.Router()

// Texto
router.post('/text', async (req, res) => {
  const { number, message } = req.body
  if (!sock || !isConnected)
    return res.json({ success: false, error: 'No conectado' })

  const jid = `${number}@s.whatsapp.net`
  await sock.sendMessage(jid, { text: message })
  res.json({ success: true })
})

// Imagen
router.post('/image', async (req, res) => {
  const { number, imageUrl, caption } = req.body
  const jid = `${number}@s.whatsapp.net`

  await sock.sendMessage(jid, {
    image: { url: imageUrl },
    caption
  })

  res.json({ success: true })
})

// Archivo
router.post('/file', async (req, res) => {
  const { number, fileUrl, fileName, mimetype } = req.body
  const jid = `${number}@s.whatsapp.net`

  await sock.sendMessage(jid, {
    document: { url: fileUrl },
    fileName,
    mimetype
  })

  res.json({ success: true })
})

export default router
