import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

export interface IListing {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title?: string | null;
  description?: string | null;
  condition?: string | null;
  price?: number | null;
  photoUrl?: string[];
  colors?: string[];
  attributes?: Record<string, unknown>;
  gender?: string | null;
  itemType?: string | null;
  status?: string | null;
  sku?: string | null;
  tags?: string[];
  stock?: number;
  // Mascara por plataforma: { depop: ["url1", "url2", ...], vinted: [...] }.
  // Si una plataforma no aparece aqui, se asume que se suben las primeras
  // N fotos de photoUrl segun el limite de esa plataforma.
  photoSelection?: Record<string, string[]>;
  lastUpdate?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const listingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, default: null },
    description: { type: String, default: null },
    condition: { type: String, default: null },
    price: { type: Number, default: null },
    photoUrl: { type: [String], default: [] },
    colors: { type: [String], default: [] },
    attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
    gender: { type: String, default: null },
    itemType: { type: String, default: null },
    status: { type: String, default: "active" },
    sku: { type: String, default: null },
    tags: { type: [String], default: [] },
    stock: { type: Number, default: 1 },
    photoSelection: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastUpdate: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

listingSchema.index({ userId: 1, createdAt: -1 });
listingSchema.plugin(toJSON);

export default (mongoose.models.Listing ||
  mongoose.model("Listing", listingSchema)) as mongoose.Model<IListing>;