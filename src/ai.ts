import 'dotenv/config'

import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL || 'https://models.inference.ai.azure.com',
})
