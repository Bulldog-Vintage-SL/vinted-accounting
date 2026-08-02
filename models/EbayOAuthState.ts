import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

export interface IEbayOAuthState {
  _id?: mongoose.Types.ObjectId;
  state: string;
  userId: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const ebayOAuthStateSchema = new mongoose.Schema(
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

ebayOAuthStateSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

ebayOAuthStateSchema.plugin(toJSON);

export default (mongoose.models.EbayOAuthState ||
  mongoose.model("EbayOAuthState", ebayOAuthStateSchema)) as mongoose.Model<IEbayOAuthState>;
