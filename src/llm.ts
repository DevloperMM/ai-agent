import type { AIMessage } from '../types'
import { zodFunction, zodResponseFormat } from 'openai/helpers/zod'
import { openai } from './ai'
import { systemPrompt as defaultSystemPrompt } from './systemPrompt'
import { z } from 'zod'
import { getSummary } from './memory'

export const runLLM = async ({
  messages,
  tools = [],
  temperature = 0.1,
  systemPrompt,
}: {
  messages: AIMessage[]
  tools?: any[]
  temperature?: number
  systemPrompt?: string
}) => {
  const formattedTools = tools.map(zodFunction)
  const summary = await getSummary()

  console.log(messages)
  console.log('---------------------------')
  console.log(summary)
  console.log('---------------------------')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature,
    messages: [
      {
        role: 'system',
        content: `${systemPrompt || defaultSystemPrompt}. Conversation summary so far: ${summary}`,
      },
      ...messages,
    ],
    ...(formattedTools.length > 0 && {
      tools: formattedTools,
      tool_choice: 'auto',
      parallel_tool_calls: false,
    }),
  })

  return response.choices[0].message
}

export const runApprovalCheck = async (userMessage: string) => {
  const result = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    response_format: zodResponseFormat(
      z.object({
        approved: z.boolean().describe('did the user say they approved or not'),
      }),
      'approval',
    ),
    messages: [
      {
        role: 'system',
        content:
          'Determine if the user approved the image generation. If you are not sure, then it is not approved.',
      },
      { role: 'user', content: userMessage },
    ],
  })

  // console.log(JSON.stringify(result.choices[0].message, null, 2))

  return result.choices[0].message.parsed?.approved
}

export const summarizeMessages = async (
  existingSummary: string,
  messagesToSummarize: AIMessage[],
) => {
  const messagesPrompt = messagesToSummarize
    .map((m) => {
      const toolCalls = 'tool_calls' in m && m.tool_calls ? JSON.stringify(m.tool_calls) : ''
      return `${m.role}: ${m.content || toolCalls}`
    })
    .join('\n')

  const prompt = existingSummary
    ? `Here is the existing summary of the conversation:\n${existingSummary}\n\nHere are new messages to incorporate into the summary:\n${messagesPrompt}\n\nProvide a new consolidated summary of the conversation history so far. Keep it concise but capture all key details and outcomes.`
    : `Here are the messages to summarize:\n${messagesPrompt}\n\nProvide a concise summary of this conversation history.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          'Your job is to write a concise summary of the conversation history to be used in an LLM system prompt. Focus on key decisions, tool executions, and user requests.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  return response.choices[0].message.content || ''
}
