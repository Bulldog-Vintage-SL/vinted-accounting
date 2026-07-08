import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

export interface IShopifyOAuthState {
  _id?: mongoose.Types.ObjectId;
  state: string;
  userId: mongoose.Types.ObjectId;
  shop: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const shopifyOAuthStateSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shop: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

shopifyOAuthStateSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

shopifyOAuthStateSchema.plugin(toJSON);

export default (mongoose.models.ShopifyOAuthState ||
  mongoose.model("ShopifyOAuthState", shopifyOAuthStateSchema)) as mongoose.Model<IShopifyOAuthState>;
