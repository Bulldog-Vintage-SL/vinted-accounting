import mongoose, { Schema, model, models, Document } from "mongoose";

export interface IBrand extends Document {
  vinted_id?: number;
  name: string;
  slug?: string | null;
  source: string;
}

const BrandSchema = new Schema<IBrand>(
  {
    vinted_id: { type: Number, index: true },
    name: { type: String, required: true },
    slug: { type: String, default: null },
    source: { type: String, default: "vinted" },
  },
  { timestamps: true }
);

BrandSchema.index({ name: 1 });

const Brand =
  (models.Brand as mongoose.Model<IBrand>) ||
  model<IBrand>("Brand", BrandSchema, "brands");

export default Brand;