import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 4, baseDelayMs = 500 }: { retries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;

      const status = (err as { status?: number })?.status;
      const isRateLimit = status === 429;

      if (!isRateLimit || attempt === retries) {
        throw err;
      }

      const retryAfterHeader = (err as { headers?: Record<string, string> })?.headers?.["retry-after"];
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
      const backoffMs = baseDelayMs * 2 ** attempt;
      const jitter = Math.random() * 200;
      const waitMs = retryAfterMs ?? backoffMs + jitter;

      console.warn(
        `[withRetry] 429 recibido (intento ${attempt + 1}/${retries + 1}), reintentando en ${Math.round(waitMs)}ms`
      );

      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastErr;
}

const ReplySchema = z.object({
  reply: z
    .string()
    .describe(
      "Texto de la respuesta que se enviará tal cual al comprador. " +
      "Sin comillas, sin prefijos tipo 'Respuesta:' y sin explicaciones."
    ),
});

// Máximo de mensajes del hilo que se pasan al modelo (los más recientes)
const MAX_THREAD_MESSAGES = 20;
// Máximo de caracteres de las indicaciones extra del vendedor
const MAX_INSTRUCTIONS_LENGTH = 500;

const FOLLOW_UP_INSTRUCTIONS =
  "IMPORTANTE: el último mensaje de la conversación es TUYO y el comprador todavía no ha contestado. " +
  "No respondas a nada: escribe un mensaje de seguimiento breve (1-2 frases), amable y sin presionar, " +
  "que retome el hilo (por ejemplo, preguntar si sigue interesado o si tiene alguna duda sobre la prenda). " +
  "No repitas lo que ya dijiste, no inventes urgencia ni ofrezcas descuentos.";

// Forma flexible: depende de lo que devuelva buildResponseContext
type ContextMessage = {
  content?: string;
  text?: string;
  isOwn?: boolean;
  role?: string;
  sender?: string;
};

const isOwnMessage = (m: ContextMessage) =>
  m.isOwn === true ||
  m.role === "assistant" ||
  m.role === "seller" ||
  m.sender === "me" ||
  m.sender === "seller";

// Acepta un string ya formateado o un array de mensajes
function buildThreadContext(messages: unknown): string {
  if (typeof messages === "string") return messages.trim();

  if (!Array.isArray(messages)) return "";

  return (messages as ContextMessage[])
    .map((m) => ({ own: isOwnMessage(m), text: (m.content ?? m.text ?? "").trim() }))
    .filter((m) => m.text)
    .slice(-MAX_THREAD_MESSAGES)
    .map((m) => `${m.own ? "Vendedor (tú)" : "Comprador"}: ${m.text}`)
    .join("\n");
}

async function generateReply(input: {
  platform?: string;
  contactName?: string;
  listingTitle?: string;
  threadContext: string;
  followUp?: boolean;
  instructions?: string;
}) {
  const response = await withRetry(() =>
    openai.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Eres el vendedor de una tienda de ropa vintage de segunda mano que atiende los mensajes " +
            "de compradores en marketplaces (Vinted, Depop, Wallapop, Vestiaire Collective). " +
            "Responde SIEMPRE al último mensaje del comprador, de forma natural, cercana y breve (1-3 frases). " +
            "Responde en el mismo idioma en el que escribe el comprador. " +
            "No inventes datos que no aparezcan en la conversación (medidas, estado, envíos, descuentos, plazos). " +
            "Si te piden algo que no puedes confirmar con la información disponible, di que lo compruebas y respondes enseguida. " +
            "No aceptes ni propongas rebajas de precio por tu cuenta ni saques la conversación fuera de la plataforma " +
            "(nada de WhatsApp, Bizum, PayPal externo, etc.). " +
            "No uses hashtags ni emojis en exceso (máximo uno). " +
            "No repitas lo que ya has dicho antes en el hilo. " +
            "Devuelve únicamente el texto del mensaje a enviar." +
            (input.followUp ? `\n\n${FOLLOW_UP_INSTRUCTIONS}` : "") +
            (input.instructions
              ? "\n\nIndicaciones adicionales del vendedor para este lote de respuestas " +
                "(síguelas, pero sin inventar datos que no estén en la conversación): " +
                input.instructions
              : ""),
        },
        {
          role: "user",
          content:
            `Plataforma: ${input.platform ?? "desconocida"}\n` +
            `Comprador: ${input.contactName ?? "desconocido"}\n` +
            `Producto: ${input.listingTitle ?? "no indicado"}\n\n` +
            `Conversación (de más antiguo a más reciente):\n${input.threadContext}\n\n` +
            (input.followUp
              ? "Redacta el mensaje de seguimiento del vendedor."
              : "Redacta la siguiente respuesta del vendedor."),
        },
      ],
      response_format: zodResponseFormat(ReplySchema, "reply"),
    })
  );

  const parsed = response.choices[0].message.parsed;
  if (!parsed?.reply?.trim()) throw new Error("No se pudo generar la respuesta");
  return parsed.reply.trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const platform = typeof body.platform === "string" ? body.platform : undefined;
    const contactName = typeof body.contactName === "string" ? body.contactName : undefined;
    const listingTitle = typeof body.listingTitle === "string" ? body.listingTitle : undefined;
    const followUp = body.followUp === true;
    const instructions =
      typeof body.instructions === "string" && body.instructions.trim()
        ? body.instructions.trim().slice(0, MAX_INSTRUCTIONS_LENGTH)
        : undefined;

    const threadContext = buildThreadContext(body.messages);
    if (!threadContext) {
      return Response.json({ error: "Missing messages" }, { status: 400 });
    }

    const reply = await generateReply({
      platform,
      contactName,
      listingTitle,
      threadContext,
      followUp,
      instructions,
    });

    return Response.json({ reply });
  } catch (err) {
    console.error("Response suggestions error:", err);

    const status = (err as { status?: number })?.status === 429 ? 429 : 500;

    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to generate response" },
      { status },
    );
  }
}