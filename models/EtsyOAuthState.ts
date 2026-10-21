import mongoose, { Schema } from "mongoose";

export interface IEtsyOAuthState {
  _id?: mongoose.Types.ObjectId;
  state: string;
  userId: mongoose.Types.ObjectId;
  codeVerifier: string;
  createdAt?: Date;
}

const EtsyOAuthStateSchema = new Schema<IEtsyOAuthState>({
  state: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  codeVerifier: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 },
});

export default (mongoose.models.EtsyOAuthState ||
  mongoose.model<IEtsyOAuthState>(
    "EtsyOAuthState",
    EtsyOAuthStateSchema
  )) as mongoose.Model<IEtsyOAuthState>;