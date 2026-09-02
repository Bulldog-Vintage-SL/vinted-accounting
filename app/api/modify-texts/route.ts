import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ModifiedTextsSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { title, description } = body;

    if (typeof title !== "string" || typeof description !== "string") {
      return Response.json(
        { error: "title and description must be strings" },
        { status: 400 }
      );
    }

    const response = await openai.chat.completions.parse({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente que modifica ligeramente títulos y descripciones " +
            "de productos de ropa para marketplaces de segunda mano.\n\n" +

            "Tu objetivo NO es reescribir el texto completamente. Debes realizar " +
            "cambios para que el texto sea diferente del original " +
            "manteniendo exactamente la misma información pero puedes mantener cosas del original.\n\n" +

            "REGLAS PARA EL TÍTULO:\n" +
            "- Mantén más o menos las mismas palabras.\n" +
            "- Cambia ligeramente el orden de algunas palabras cuando sea natural.\n" +
            "- No añadas información nueva.\n" +
            "- No elimines información importante.\n" +
            "- Mantén el idioma original.\n" +

            "REGLAS PARA LA DESCRIPCIÓN:\n" +
            "- Haz cambios pequeños en la redacción.\n" +
            "- Puedes cambiar ligeramente el orden de alguna frase o utilizar sinónimos sencillos.\n" +
            "- Mantén exactamente la misma información sobre la prenda.\n" +
            "- No inventes características, materiales, medidas, estado, marca o cualquier otro dato.\n" +
            "- No elimines información relevante.\n" +
            "- Mantén emojis, hashtags y formato siempre que sea posible.\n" +
            "- No añadas frases nuevas que no estén justificadas por el texto original.\n" +
            "- El resultado debe ser ligeramente parecido al original.\n\n" +

            "IMPORTANTE: La modificación debe ser sutil. Si el texto original tiene 100 palabras, " +
            "el resultado debería tener aproximadamente el mismo número de palabras."
        },
        {
          role: "user",
          content:
            `Título original:\n${title}\n\n` +
            `Descripción original:\n${description}\n\n` +
            "Devuelve ambos textos con modificaciones mínimas.",
        },
      ],
      response_format: zodResponseFormat(
        ModifiedTextsSchema,
        "modifiedTexts"
      ),
    });

    const parsed = response.choices[0].message.parsed;

    if (!parsed) {
      throw new Error("No se pudieron parsear los textos modificados");
    }

    return Response.json({
      title: parsed.title,
      description: parsed.description,
    });
  } catch (err) {
    console.error("Modify texts error:", err);

    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to modify texts",
      },
      { status: 500 }
    );
  }
}