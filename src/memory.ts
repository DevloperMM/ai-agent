import { JSONFilePreset } from 'lowdb/node'
import type { AIMessage } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { summarizeMessages } from './llm'

export type MessageWithMetadata = AIMessage & {
  id: string
  createdAt: string
}

type Data = {
  messages: MessageWithMetadata[]
  summary: string
}

export const addMetadata = (message: AIMessage) => {
  return {
    ...message,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  }
}

export const removeMetadata = (message: MessageWithMetadata) => {
  const { id, createdAt, ...rest } = message
  return rest
}

const defaultData: Data = {
  messages: [],
  summary: '',
}

export const getDb = async () => {
  const db = await JSONFilePreset<Data>('db.json', defaultData)
  return db
}

export const addMessages = async (messages: AIMessage[]) => {
  const db = await getDb()
  db.data.messages.push(...messages.map(addMetadata))

  if (db.data.messages.length >= 10) {
    let splitIndex = -1

    // Try to find the latest 'user' message in the range [1, length - 5]
    for (let i = db.data.messages.length - 5; i > 0; i--) {
      if (db.data.messages[i].role === 'user') {
        splitIndex = i
        break
      }
    }

    // Fallback: find any safe split point in the range [1, length - 5]
    if (splitIndex <= 0) {
      for (let i = db.data.messages.length - 5; i > 0; i--) {
        const current = db.data.messages[i]
        const prev = db.data.messages[i - 1]
        const isCurrentTool = current.role === 'tool'
        const isPrevToolCall =
          prev.role === 'assistant' &&
          'tool_calls' in prev &&
          Array.isArray(prev.tool_calls) &&
          prev.tool_calls.length > 0
        if (!isCurrentTool && !isPrevToolCall) {
          splitIndex = i
          break
        }
      }
    }

    if (splitIndex > 0) {
      const oldestMsgs = db.data.messages.slice(0, splitIndex).map(removeMetadata)
      const summary = await summarizeMessages(db.data.summary, oldestMsgs)
      db.data.summary = summary
      db.data.messages = db.data.messages.slice(splitIndex)
    }
  }

  await db.write()
}

export const getMessages = async () => {
  const db = await getDb()
  return db.data.messages.map(removeMetadata)
}

export const saveToolResponse = async (
  toolCallId: string,
  toolResponse: string,
) => {
  return addMessages([
    {
      role: 'tool',
      content: toolResponse,
      tool_call_id: toolCallId,
    },
  ])
}

export const getSummary = async () => {
  const db = await getDb()
  return db.data.summary
}
