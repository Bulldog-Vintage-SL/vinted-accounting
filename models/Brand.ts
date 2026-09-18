import mongoose, { Schema, models, model } from "mongoose";

const BrandSchema = new Schema(
  {
    vinted_id: { type: Number, index: true },
    name: { type: String, required: true },
    slug: { type: String, default: null },
    source: { type: String, default: "vinted" },
  },
  { timestamps: true }
);

// Índice normal para acelerar el sort/lookup por nombre.
// Para autocomplete con prefijos/fuzzy a este volumen, valorar migrar a Atlas Search ($search)
// más adelante — este índice no acelera un regex con substring libre (solo prefijo).
BrandSchema.index({ name: 1 });

export default models.Brand || model("Brand", BrandSchema, "brands");