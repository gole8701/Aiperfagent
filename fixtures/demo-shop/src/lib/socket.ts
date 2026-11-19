let socket: WebSocket | undefined

export function connect(): void {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/live`
  socket = new WebSocket(url)
  socket.onmessage = (event) => {
    document.dispatchEvent(new CustomEvent('stock', { detail: JSON.parse(String(event.data)) }))
  }
  // Problem 4: reconnects immediately, forever. When the server restarts this
  // becomes a storm of connections.
  socket.onclose = () => {
    connect()
  }
}

export function send(message: unknown): void {
  socket?.send(JSON.stringify(message))
}
