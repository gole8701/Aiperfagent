import { createServer, type IncomingMessage, type Server } from 'node:http'

/** A stand-in for OpenAI (Chat Completions) and Anthropic (Messages), streaming and not. Answers come from `reply`. */
export interface StubServer {
  url: string
  requests: { path: string; headers: IncomingMessage['headers']; body: Record<string, unknown> }[]
  reply: (body: Record<string, unknown>) => string
  status: number
  close: () => Promise<void>
}

export async function startStubServer(): Promise<StubServer> {
  const stub: StubServer = {
    url: '',
    requests: [],
    reply: () => 'OK',
    status: 200,
    close: () => Promise.resolve(),
  }
  const server: Server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c: Buffer) => {
      raw += c.toString()
    })
    req.on('end', () => {
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      stub.requests.push({ path: req.url ?? '', headers: req.headers, body })
      if (stub.status !== 200) {
        res.writeHead(stub.status, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: { message: 'stub failure' } }))
        return
      }
      if (req.url === '/v1/models') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ data: [{ id: 'gpt-4.1-mini' }, { id: 'gpt-4o' }] }))
        return
      }
      const text = stub.reply(body)
      const usage = { in: 120, out: Math.max(1, Math.ceil(text.length / 4)), cached: 20 }
      if (req.url === '/v1/messages') {
        if (body.stream) {
          res.writeHead(200, { 'content-type': 'text/event-stream' })
          res.write(
            `event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { model: body.model, usage: { input_tokens: usage.in, cache_read_input_tokens: usage.cached } } })}\n\n`,
          )
          res.write(
            `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n\n`,
          )
          res.end(
            `event: message_delta\ndata: ${JSON.stringify({ type: 'message_delta', usage: { output_tokens: usage.out } })}\n\n`,
          )
        } else {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(
            JSON.stringify({
              model: body.model,
              content: [{ type: 'text', text }],
              usage: {
                input_tokens: usage.in,
                output_tokens: usage.out,
                cache_read_input_tokens: usage.cached,
              },
            }),
          )
        }
        return
      }
      if (body.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        for (const piece of text.match(/.{1,40}/gs) ?? [''])
          res.write(
            `data: ${JSON.stringify({ model: body.model, choices: [{ delta: { content: piece } }] })}\n\n`,
          )
        res.write(
          `data: ${JSON.stringify({ model: body.model, choices: [], usage: { prompt_tokens: usage.in, completion_tokens: usage.out, prompt_tokens_details: { cached_tokens: usage.cached } } })}\n\n`,
        )
        res.end('data: [DONE]\n\n')
      } else {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            model: body.model,
            choices: [{ message: { content: text } }],
            usage: {
              prompt_tokens: usage.in,
              completion_tokens: usage.out,
              prompt_tokens_details: { cached_tokens: usage.cached },
            },
          }),
        )
      }
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  stub.url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  stub.close = () => new Promise((resolve) => server.close(() => resolve()))
  return stub
}
