import { NextRequest } from 'next/server'

let clients: { id: number, send: (msg: string) => void }[] = []
let clientId = 0

export async function POST(req: NextRequest) {
  const { image_id, model, result } = await req.json()
  const payload = `data: ${JSON.stringify({ image_id, model, result })}\n\n`
  clients.forEach(client => client.send(payload))
  return new Response(JSON.stringify({ message: 'Webhook received' }), { status: 200 })
}

export async function GET() {
  let id: number;
  let keepAlive: NodeJS.Timeout;
  const stream = new ReadableStream({
    start(controller) {
      id = clientId++;
      const send = (msg: string) => controller.enqueue(new TextEncoder().encode(msg));
      clients.push({ id, send });
      // Keep-alive
      keepAlive = setInterval(() => {
        send(':\n\n');
      }, 30000);
    },
    cancel() {
      clearInterval(keepAlive);
      clients = clients.filter(c => c.id !== id);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
} 