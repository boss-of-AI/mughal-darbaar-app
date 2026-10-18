type Writer = (chunk: string) => void;

const g = globalThis as unknown as { __sseClients?: Set<Writer> };
export const sseClients: Set<Writer> = (g.__sseClients ??= new Set<Writer>());

export function pushOrderEvent(event: string, payload: object) {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach((writer) => {
    try {
      writer(chunk);
    } catch {
      sseClients.delete(writer);
    }
  });
}
