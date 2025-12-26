import express from 'express'
import bodyParser from 'body-parser'

import connectionRoutes from './routes/connection.routes.js'
import sendRoutes from './routes/send.routes.js'
import incomingRoutes, { handleIncomingMessages } from './routes/incoming.routes.js'

import { connectToWhatsApp } from './whatsapp/socket.js'
const { connectDB, prisma } = require('./db');

const app = express()
connectDB();

app.use(bodyParser.json())
app.use(express.static('public'))

// Rutas
app.use('/connection', connectionRoutes)
app.use('/send', sendRoutes)
app.use('/incoming', incomingRoutes)

// Conectar WhatsApp
connectToWhatsApp(handleIncomingMessages)

app.listen(8080, () =>
  console.log('🚀 Servidor en http://localhost:8080')
)
