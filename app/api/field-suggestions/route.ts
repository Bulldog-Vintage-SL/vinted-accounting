import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { getFlatCategories, findCategoryById, findClosestHombreCategory } from "@/lib/categories";
import { matchBrand } from "@/lib/brands";
import { COLOR_OPTIONS, SIZE_OPTIONS, CONDITION_OPTIONS } from "@/lib/constants";
import fs from "fs";
import path from "path";

const GUIDE_CONTENT = fs.readFileSync(
  path.join(process.cwd(), "data", "documento-guia-gpt.txt"),
  "utf-8"
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


const TitleAndDescriptionSchema = z.object({
  title: z.string(),
  description: z.string(),
});

async function generateTitleAndDescription(imgUrl: string) {
  const response = await openai.chat.completions.parse({
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
  });

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

async function generateFields(imgUrl: string, draftTitle: string, similarListings: unknown) {
  const categories = getFlatCategories();
  const categoriesContext = categories.map(c => ({ id: c.id, path: c.path }));

  const response = await openai.chat.completions.parse({
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
              `Usa como guía para descripción y título esto: \n${GUIDE_CONTENT}\n\n` +
              "Genera los campos del producto en base a la imagen y este contexto.",
          },
          { type: "image_url", image_url: { url: imgUrl } },
        ],
      },
    ],
    response_format: zodResponseFormat(FieldsSchema, "fields"),
  });

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


const SizeConditionSchema = z.object({
  size: z
    .enum(SIZE_OPTIONS)
    .nullable()
    .describe(
      "Talla EXACTA leída en una etiqueta visible en alguna de las imágenes proporcionadas. " +
      "Usa null si ninguna imagen muestra una etiqueta legible con la talla — NUNCA la adivines por el corte de la prenda."
    ),
  condition: z
    .enum(CONDITION_OPTIONS)
    .nullable()
    .describe(
      "Estado de la prenda (desgaste, manchas, roturas, aspecto de 'nuevo con etiquetas', etc), " +
      "solo si hay confianza razonable a partir de las imágenes. Usa null si no hay información suficiente."
    ),
});

async function generateSizeAndCondition(
  imgUrls: string[]
): Promise<{ size: string | null; condition: string | null }> {
  const response = await openai.chat.completions.parse({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Eres un asistente que analiza fotos de una prenda de ropa de segunda mano para determinar su talla y estado. " +
          "Para 'size': SOLO la indiques si ves explícitamente una etiqueta con la talla escrita y legible en alguna imagen. " +
          "Si la prenda no es de mujer elige una categoría de Hombre." +
          "Para el precio guíate con los productos similares de ejemplo un poco, pero también por factores como si la marca es de lujo o no" +
          "Si la marca es rollo STWD u otra pero sale tb Pull&Bear prioriza marcar como marca lo segundo, asi tb con Zara, etc." +
          "Si ninguna imagen muestra una etiqueta de talla, devuelve null — no infieras la talla por el aspecto general de la prenda. " +
          "Para 'condition': evalúa el estado solo si tienes confianza razonable observando las imágenes; si no, devuelve null.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analiza estas imágenes de la prenda y determina la talla (si hay etiqueta visible) y el estado.",
          },
          ...imgUrls.map(url => ({ type: "image_url" as const, image_url: { url } })),
        ],
      },
    ],
    response_format: zodResponseFormat(SizeConditionSchema, "sizeCondition"),
  });

  const parsed = response.choices[0].message.parsed;
  if (!parsed) throw new Error("No se pudo analizar talla/estado");

  return {
    size: parsed.size ?? null,
    condition: parsed.condition ?? null,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const imgUrls: string[] = Array.isArray(body.imgUrls) ? body.imgUrls.slice(0, 3) : [];
    const suggestSizeCondition = Boolean(body.suggestSizeCondition);

    if (imgUrls.length === 0 || typeof imgUrls[0] !== "string") {
      return Response.json({ error: "Missing or invalid imgUrls" }, { status: 400 });
    }

    const mainImgUrl = imgUrls[0];

    const { title: draftTitle, description: draftDescription } = await generateTitleAndDescription(mainImgUrl);
    const similarListings = await getSimilarListings(draftTitle, draftDescription, body.k ?? 5);
    const fields = await generateFields(mainImgUrl, draftTitle, similarListings);

    let sizeCondition: { size: string | null; condition: string | null } = {
      size: null,
      condition: null,
    };

    if (suggestSizeCondition) {
      sizeCondition = await generateSizeAndCondition(imgUrls);
    }

    return Response.json({ ...fields, ...sizeCondition });

  } catch (err) {
    console.error("Field suggestions error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to generate fields" },
      { status: 500 }
    );
  }
}