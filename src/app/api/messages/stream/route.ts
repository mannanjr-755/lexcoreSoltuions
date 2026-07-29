import { getSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api-error";
import { isAuthorizedEmail } from "@/lib/authorized-users";
import { getTypingUsers, subscribeMessagesRealtime } from "@/services/messages-realtime.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !isAuthorizedEmail(session.email)) return unauthorized();

  const encoder = new TextEncoder();
  let closed = false;
  let dispose: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send("connected", { ok: true, typingUsers: getTypingUsers() });

      const unsubscribe = subscribeMessagesRealtime((event) => {
        send(event.type, event);
      });

      const ping = setInterval(() => {
        send("ping", { at: new Date().toISOString() });
      }, 15000);

      const typingRefresh = setInterval(() => {
        send("typing.snapshot", { typingUsers: getTypingUsers() });
      }, 5000);

      controller.enqueue(encoder.encode(`retry: 3000\n\n`));

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        clearInterval(typingRefresh);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      };
      req.signal.addEventListener("abort", cleanup);
      dispose = cleanup;
    },
    cancel() {
      dispose?.();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
