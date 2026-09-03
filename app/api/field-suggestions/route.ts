import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { getFlatCategories, findCategoryById, findClosestHombreCategory } from "@/lib/categories";
import { matchBrand } from "@/lib/brands";
import { COLOR_OPTIONS } from "@/lib/constants";
import fs from "fs";
import path from "path";

const GUIDE_CONTENT = fs.readFileSync(
  path.join(process.cwd(), "data", "documento-guia-gpt.txt"),
  "utf-8"
);

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

      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  throw lastErr;
}

const TitleAndDescriptionSchema = z.object({
  title: z.string(),
  description: z.string(),
});

async function generateTitleAndDescription(imgUrl: string) {
  const response = await withRetry(() =>
    openai.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Genera un título corto y descriptivo, y una descripción breve (2-3 frases) " +
                "para este producto de segunda mano como si lo fueses a subir a un marketplace como Vinted, titulo en ingles y descripcion en español.",
            },
            { type: "image_url", image_url: { url: imgUrl } },
          ],
        },
      ],
      response_format: zodResponseFormat(TitleAndDescriptionSchema, "titleAndDescription"),
    })
  );

  const parsed = response.choices[0].message.parsed;
  if (!parsed) throw new Error("No se pudo parsear título/descripción");
  return parsed;
}

async function getSimilarListings(title: string, description: string, k: number) {
  const res = await fetch("http://164.132.110.179:8000/retrieve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.RAG_RETREIVAL_API_KEY!,
    },
    body: JSON.stringify({ title, description, k }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RAG service error: ${errText}`);
  }

  return res.json();
}

const FieldsSchema = z.object({
  title: z.string().describe(
    "Título corto y descriptivo del producto para el marketplace, en inglés, " +
    "generado ya con el contexto completo (listings similares y guía)."
  ),
  description: z.string(),
  brand: z.string().describe(
    "Nombre de la marca detectada en la prenda (logo, etiqueta, texto visible). " +
    "Usa 'Sin marca' si no hay marca identificable o visible en la imagen."
  ),
  colors: z.array(z.enum(COLOR_OPTIONS)).min(1).describe(
    "Colores dominantes de la prenda, EXACTAMENTE de esta lista, en español"
  ),
  price: z.number().describe("Precio sugerido en euros, coherente con los listings similares"),
  gender: z
    .enum(["hombre", "mujer", "unisex"])
    .describe("Género de la prenda según su corte/diseño. Usa 'unisex' si no tiene un corte marcadamente masculino o femenino."),
  categoryId: z
    .number()
    .describe("El id de la categoría más adecuada, SI LA PRENDA ES DE CORTE UNISEX PRIORIZA ELEGIR UNA OPCIÓN DE HOMBRE, EXACTAMENTE uno de los ids de la lista proporcionada"),
});

type ManualFieldsInput = {
  talla: string | null;
  garmentType: "arriba" | "abajo" | null;
  medidas: Record<string, string> | null;
  desperfectos: string[];
  costeInicial: number | null;
};

// Convierte los datos rellenados a mano por el vendedor en texto de contexto
// para que el modelo los incorpore de forma natural en la descripción.
function buildManualContext(input: ManualFieldsInput): string {
  const lines: string[] = [];

  if (input.talla) {
    lines.push(`Talla indicada por el vendedor: ${input.talla}`);
  }

  if (input.garmentType && input.medidas) {
    const medidasLabel = input.garmentType === "arriba"
      ? `Axila a axila: ${input.medidas.axilaAxila || "-"}, Hombro a hombro: ${input.medidas.hombroHombro || "-"}, Largo: ${input.medidas.largo || "-"}, Manga: ${input.medidas.manga || "-"}`
      : `Ancho cintura: ${input.medidas.anchoCintura || "-"}, Largo: ${input.medidas.largo || "-"}, Cadera a entrepierna: ${input.medidas.caderaEntrepierna || "-"}, Ancho tobillo: ${input.medidas.anchoTobillo || "-"}`;
    lines.push(`Medidas de la prenda (${input.garmentType}): ${medidasLabel}. Inclúyelas en la descripción de forma natural.`);
  }

  const desperfectosReales = input.desperfectos.filter(d => d !== "Sin desperfectos");
  if (desperfectosReales.length > 0) {
    lines.push(`Desperfectos a mencionar honestamente en la descripción: ${desperfectosReales.join(", ")}.`);
  } else {
    lines.push("La prenda no tiene desperfectos, puedes mencionarlo como algo positivo si encaja de forma natural.");
  }

  if (typeof input.costeInicial === "number" && !Number.isNaN(input.costeInicial)) {
    lines.push(
      `Coste de compra de la prenda para el vendedor: ${input.costeInicial}€. ` +
      "Úsalo solo como referencia interna para que el precio de venta sugerido deje un margen de beneficio razonable; " +
      "NUNCA menciones este coste en la descripción."
    );
  }

  return lines.join("\n");
}

async function generateFields(imgUrl: string, draftTitle: string, similarListings: unknown, manualContext: string) {
  const categories = getFlatCategories();
  const categoriesContext = categories.map(c => ({ id: c.id, path: c.path }));

  const response = await withRetry(() =>
    openai.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente que rellena campos de producto para un marketplace de ropa de segunda mano (estilo Vinted). " +
            "Usa la imagen del producto y, como referencia de precio y estilo, los listings similares en JSON. " +
            "Genera también un título nuevo y definitivo (no te limites a copiar el título borrador). " +
            "Para la categoría, DEBES elegir un id EXACTO de la lista de categorías válidas proporcionada; nunca inventes un id que no esté en la lista.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Título borrador (solo como referencia, genera uno nuevo mejorado): "${draftTitle}"\n\n` +
                `Listings similares (referencia de precio/tono, no copiar literalmente):\n${JSON.stringify(similarListings)}\n\n` +
                `Categorías válidas (elige un "id" de aquí):\n${JSON.stringify(categoriesContext)}\n\n` +
                `Datos proporcionados manualmente por el vendedor:\n${manualContext}\n\n` +
                `Usa como guía para descripción y título esto: \n${GUIDE_CONTENT}\n\n` +
                "Genera los campos del producto en base a la imagen y este contexto, incorporando de forma natural " +
                "las medidas y los desperfectos indicados en la descripción.",
            },
            { type: "image_url", image_url: { url: imgUrl} },
          ],
        },
      ],
      response_format: zodResponseFormat(FieldsSchema, "fields"),
    })
  );

  const parsed = response.choices[0].message.parsed;
  if (!parsed) throw new Error("No se pudieron parsear los campos generados");

  let matchedCategory = findCategoryById(parsed.categoryId);

  if (parsed.gender !== "mujer" && matchedCategory?.gender === "mujer") {
    const equivalent = findClosestHombreCategory(matchedCategory.title);
    if (equivalent) matchedCategory = equivalent;
  }

  const matchedBrand = matchBrand(parsed.brand);

  return {
    title: parsed.title,
    description: parsed.description,
    brand: matchedBrand,
    colors: parsed.colors,
    price: parsed.price,
    gender: parsed.gender,
    category: matchedCategory
      ? { id: matchedCategory.id, path: matchedCategory.path, title: matchedCategory.title }
      : null,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Solo se admite una única foto por prenda ahora (la primera del grupo)
    const imgUrl: string | undefined =
      typeof body.imgUrl === "string"
        ? body.imgUrl
        : Array.isArray(body.imgUrls) && typeof body.imgUrls[0] === "string"
          ? body.imgUrls[0]
          : undefined;

    if (!imgUrl) {
      return Response.json({ error: "Missing imgUrl" }, { status: 400 });
    }

    const talla: string | null = typeof body.talla === "string" && body.talla.trim() ? body.talla.trim() : null;
    const garmentType: "arriba" | "abajo" | null =
      body.garmentType === "arriba" || body.garmentType === "abajo" ? body.garmentType : null;
    const medidas: Record<string, string> | null =
      body.medidas && typeof body.medidas === "object" ? body.medidas : null;
    const desperfectos: string[] = Array.isArray(body.desperfectos) ? body.desperfectos : [];
    const sku: string = typeof body.sku === "string" ? body.sku.trim() : "";
    const costeInicial: number | null = typeof body.costeInicial === "number" ? body.costeInicial : null;

    const { title: draftTitle, description: draftDescription } = await generateTitleAndDescription(imgUrl);
    const similarListings = await getSimilarListings(draftTitle, draftDescription, body.k ?? 5);

    const manualContext = buildManualContext({ talla, garmentType, medidas, desperfectos, costeInicial });

    const fields = await generateFields(imgUrl, draftTitle, similarListings, manualContext);

    // El SKU se añade al final del título de forma determinista, sin depender
    // de que el modelo lo respete al pie de la letra.
    const finalTitle = sku ? `${fields.title} ${sku}`.trim() : fields.title;

    return Response.json({ ...fields, title: finalTitle });

  } catch (err) {
    console.error("Field suggestions error:", err);

    const status = (err as { status?: number })?.status === 429 ? 429 : 500;

    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to generate fields" },
      { status }
    );
  }
}