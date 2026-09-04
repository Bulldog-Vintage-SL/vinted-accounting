import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

export type UploadJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface IUploadJobAccount {
  accountId: string;
  platform: string;
}

export interface IUploadJob {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  listingId: mongoose.Types.ObjectId;
  accounts: IUploadJobAccount[];
  scheduledAt: Date;
  status: UploadJobStatus;
  executedAt?: Date | null;
  error?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const uploadJobAccountSchema = new mongoose.Schema(
  {
    accountId: { type: String, required: true },
    platform: { type: String, required: true },
  },
  { _id: false }
);

const uploadJobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      index: true,
    },
    accounts: {
      type: [uploadJobAccountSchema],
      required: true,
      validate: {
        validator: (v: IUploadJobAccount[]) => Array.isArray(v) && v.length > 0,
        message: "El job necesita al menos una cuenta destino",
      },
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    executedAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);


uploadJobSchema.index({ status: 1, scheduledAt: 1 });
uploadJobSchema.index({ userId: 1, status: 1 });

uploadJobSchema.plugin(toJSON);

export default (mongoose.models.UploadJob ||
  mongoose.model("UploadJob", uploadJobSchema)) as mongoose.Model<IUploadJob>;