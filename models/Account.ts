import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

export type AccountSyncStatus =
  | "OK"
  | "NEEDS_SYNC"
  | "ACCOUNT_NOT_FOUND"
  | "connected";

export interface IAccount {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  platform: string;
  externalId: string;
  profileLink?: string | null;
  accountName?: string | null;
  syncStatus: AccountSyncStatus;
  vestiaireId?: string | null;
  shopifyShopDomain?: string | null;
  shopifyAccessToken?: string | null;
  shopifyScopes?: string | null;
  lastSync?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const accountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      index: true,
    },
    externalId: {
      type: String,
      required: true,
      index: true,
    },
    profileLink: { type: String, default: null },
    accountName: { type: String, default: null },
    syncStatus: {
      type: String,
      enum: ["OK", "NEEDS_SYNC", "ACCOUNT_NOT_FOUND", "connected"],
      default: "OK",
    },
    vestiaireId: { type: String, default: null },
    shopifyShopDomain: { type: String, sparse: true, unique: true },
    shopifyAccessToken: { type: String, default: null },
    shopifyScopes: { type: String, default: null },
    lastSync: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

accountSchema.index({ userId: 1, platform: 1 });
accountSchema.index({ externalId: 1, platform: 1, userId: 1 }, { unique: true });

accountSchema.plugin(toJSON);

export default (mongoose.models.Account ||
  mongoose.model("Account", accountSchema)) as mongoose.Model<IAccount>;
