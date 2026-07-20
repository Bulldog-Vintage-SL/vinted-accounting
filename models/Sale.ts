import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// Tipos de estado de la venta
export type SaleStatus = "pending" | "completed" | "cancelled";

// Compañías de envío
export type ShippingCarrier = "correos" | "inpost" | "seur" | "vintedgo" | "unknown";

// Interface para TypeScript
export interface ISale {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  emailId: string; // Gmail messageId - PRIMARY KEY
  transactionId?: string;
  itemName: string;
  amount: number;
  purchasePrice?: number; // Precio de compra/coste
  status: SaleStatus;
  shippingCarrier?: ShippingCarrier;
  trackingNumber?: string;
  shippingDeadline?: Date;
  saleDate: Date;
  completedDate?: Date;
  labelMessageId?: string;
  hasLabel: boolean;
  snippet?: string;
  itemImageUrl?: string;
  isManual?: boolean; // Si fue añadida manualmente
  bundleId?: mongoose.Types.ObjectId; // Enlace al bundle
  createdAt?: Date;
  updatedAt?: Date;
}

// SALE SCHEMA
const saleSchema = new mongoose.Schema(
  {
    // Usuario dueño de la venta
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // ID del mensaje de Gmail (PRIMARY KEY - único por email)
    emailId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // ID de transacción de Vinted (opcional, puede no estar presente)
    transactionId: {
      type: String,
      index: true,
    },
    // Nombre del artículo vendido
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    // Monto de la venta en EUR (precio de venta)
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    // Precio de compra/coste del artículo
    purchasePrice: {
      type: Number,
      default: 0,
    },
    // Estado de la venta
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    // Compañía de envío
    shippingCarrier: {
      type: String,
      enum: ["correos", "inpost", "seur", "vintedgo", "unknown"],
      default: "unknown",
    },
    // Número de seguimiento
    trackingNumber: {
      type: String,
      trim: true,
    },
    // Fecha límite de envío
    shippingDeadline: {
      type: Date,
    },
    // Fecha de la venta (cuando se generó la etiqueta)
    saleDate: {
      type: Date,
      required: true,
      index: true,
    },
    // Fecha de completado (cuando se recibió el pago)
    completedDate: {
      type: Date,
    },
    // ID del mensaje de Gmail con la etiqueta de envío
    labelMessageId: {
      type: String,
    },
    // Si tiene etiqueta de envío disponible
    hasLabel: {
      type: Boolean,
      default: false,
    },
    // Snippet del correo para referencia
    snippet: {
      type: String,
    },
    // Imagen del artículo extraída del correo de Vinted
    itemImageUrl: {
      type: String,
      trim: true,
    },
    // Si la venta fue añadida manualmente
    isManual: {
      type: Boolean,
      default: false,
    },
    // Enlace al bundle (opcional)
    bundleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bundle",
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Índice compuesto para búsquedas por usuario y emailId
saleSchema.index({ userId: 1, emailId: 1 });

// Índice para búsquedas por fecha
saleSchema.index({ userId: 1, saleDate: -1 });

// add plugin that converts mongoose to json
saleSchema.plugin(toJSON);

export default (mongoose.models.Sale || mongoose.model("Sale", saleSchema)) as mongoose.Model<ISale>;
