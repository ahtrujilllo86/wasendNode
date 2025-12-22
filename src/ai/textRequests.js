// src/ai/textRequest.js
import openai from '../config/openai.js'
import dotenv from 'dotenv'

dotenv.config()

export async function askText({ system, user }) {
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL,
    input: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  })

  return response.output_text
}
