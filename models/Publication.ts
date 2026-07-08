import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

export interface IPublication {
  _id?: mongoose.Types.ObjectId;
  listingId: mongoose.Types.ObjectId;
  platform: string;
  platformId?: string | null;
  externalId: string;
  price?: number | null;
  syncStatus?: string | null;
  status?: string | null;
  publicationUrl?: string | null;
  accountId?: mongoose.Types.ObjectId | null;
  lastSync?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const publicationSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      index: true,
    },
    platformId: { type: String, default: null },
    externalId: {
      type: String,
      required: true,
      index: true,
    },
    price: { type: Number, default: null },
    syncStatus: { type: String, default: "synced" },
    status: { type: String, default: null },
    publicationUrl: { type: String, default: null },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
      index: true,
    },
    lastSync: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

publicationSchema.index({ platform: 1, externalId: 1 }, { unique: true });
publicationSchema.plugin(toJSON);

export default (mongoose.models.Publication ||
  mongoose.model("Publication", publicationSchema)) as mongoose.Model<IPublication>;
