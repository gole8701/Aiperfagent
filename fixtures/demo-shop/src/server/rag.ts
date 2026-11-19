import Anthropic from '@anthropic-ai/sdk'

import { PRODUCT_GUIDE } from './product-guide'

const client = new Anthropic()

async function embed(text: string): Promise<number[]> {
  const response = await fetch('http://127.0.0.1:11434/api/embeddings', {
    method: 'POST',
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
  })
  const data = (await response.json()) as { embedding: number[] }
  return data.embedding
}

async function searchChunks(vector: number[]): Promise<string[]> {
  const response = await fetch('http://127.0.0.1:8000/search', { method: 'POST', body: JSON.stringify({ vector, k: 5 }) })
  return (await response.json()) as string[]
}

async function lookupOrder(customerId: string): Promise<string> {
  const response = await fetch(`http://127.0.0.1:8000/orders/${customerId}`)
  return response.text()
}

export async function answerSupportQuestion(question: string, customerId: string): Promise<string> {
  // Problem 5: three independent steps awaited one after another.
  const vector = await embed(question)
  const chunks = await searchChunks(vector)
  const order = await lookupOrder(customerId)

  // Also: the 9,800-token product guide is sent uncached on every call.
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 800,
    system: PRODUCT_GUIDE,
    messages: [{ role: 'user', content: `Context:\n${chunks.join('\n')}\nOrder:\n${order}\n\nQuestion: ${question}` }],
  })
  const first = message.content[0]
  return first && first.type === 'text' ? first.text : ''
}
