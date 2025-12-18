import express from 'express'

const router = express.Router()

let lastMessages = []

router.post('/webhook', (req, res) => {
  res.sendStatus(200)
})

router.get('/messages', (req, res) => {
  res.json(lastMessages)
})

export function handleIncomingMessages(msg) {
  const message = msg.messages[0]
  if (!message?.message) return

  const text =
    message.message.conversation ||
    message.message.extendedTextMessage?.text

  lastMessages.push({
    from: message.key.remoteJid,
    text,
    date: new Date()
  })
  const messageFormatOutput = {
    remote: message.key.remoteJidAlt,
    remoteName: message.pushName,
    text,
  }
  console.log(message);
  console.log('📩 Entrante:', messageFormatOutput)
}

export default router
