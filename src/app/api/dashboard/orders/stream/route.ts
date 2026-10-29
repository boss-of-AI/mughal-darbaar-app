import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { sseClients } from "@/lib/sse";

/**
 * GET /api/dashboard/orders/stream
 *
 * Server-Sent Events endpoint for real-time order updates.
 * Railway containers keep a persistent connection open.
 * Events: "connected", "new_order", "order_updated"
 *
 * In production this endpoint receives POST from the order placement
 * API route which calls pushOrderEvent() to broadcast.
 */

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["owner", "staff", "rider"].includes(session.user.role)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected event
      controller.enqueue(encoder.encode("event: connected\ndata: {\"ok\":true}\n\n"));

      const writer = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      sseClients.add(writer);

      // Heartbeat every 25s to keep Railway connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          sseClients.delete(writer);
        }
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        sseClients.delete(writer);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Nginx / Railway — disable buffering
    },
  });
}
