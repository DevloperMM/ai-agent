import 'dotenv/config'

import type { ToolFn } from '../../types'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'url'
import path from 'path'

export const generateImageToolDefinition = {
  name: 'generate_image',
  description:
    'Generate an image when the user request can be visualized (scenes, objects, people, designs, or abstract ideas). Always use for requests like draw, create, show, imagine, or photo/picture of. Expand the input into a detailed visual prompt with style, lighting, and setting. Avoid for non-visual tasks.',
  parameters: z.object({
    prompt: z
      .string()
      .describe('A detailed visual prompt describing the image to generate.'),
  }),
}

type Args = z.infer<typeof generateImageToolDefinition.parameters>

export const generateImage: ToolFn<Args, string> = async ({ toolArgs }) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const IMAGES_DIR = path.join(__dirname, '../../images')
  mkdirSync(IMAGES_DIR, { recursive: true })

  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`

  const result = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: toolArgs.prompt,
    }),
  })

  const data = (await result.json()) as any
  const base64 = data.result.image

  writeFileSync(
    path.join(IMAGES_DIR, `image-${Date.now()}.jpg`),
    Buffer.from(base64, 'base64'),
  )

  return 'Check out the images folder to see the image'
}
