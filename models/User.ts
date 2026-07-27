import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

export interface IUser {
  _id?: mongoose.Types.ObjectId;
  name?: string;
  email?: string;
  image?: string;
  password?: string;
  customerId?: string;
  priceId?: string;
  hasAccess?: boolean;
  lastSyncAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// USER SCHEMA
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      private: true,
      unique: true,
      sparse: true,
    },
    image: {
      type: String,
    },
    password: {
      type: String,
      private: true,
      select: false,
    },
    // Used in the Stripe webhook to identify the user in Stripe and later create Customer Portal or prefill user credit card details
    customerId: {
      type: String,
      validate(value: string) {
        return value.includes("cus_");
      },
    },
    // Used in the Stripe webhook. should match a plan in config.js file.
    priceId: {
      type: String,
      validate(value: string) {
        return value.includes("price_");
      },
    },
    // Used to determine if the user has access to the product—it's turn on/off by the Stripe webhook
    hasAccess: {
      type: Boolean,
      default: false,
    },
    // Last time the user synced their Gmail data
    lastSyncAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// add plugin that converts mongoose to json
userSchema.plugin(toJSON);

export default (mongoose.models.User ||
  mongoose.model("User", userSchema)) as mongoose.Model<IUser>;
