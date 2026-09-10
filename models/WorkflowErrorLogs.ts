import mongoose, { Schema } from "mongoose";

const workflowErrorLogSchema = new Schema(
  {
    sessionId: { type: String, required: true },
    ownerUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    flow: { type: String, required: true, index: true },
    stepType: { type: String },
    stepIndex: { type: Number },
    error: { type: String, required: true },

    // Snapshot ligero, siempre util para un vistazo rapido
    context: { type: Schema.Types.Mixed },

    // Snapshot completo de la sesion en el momento del fallo (steps + state),
    // con claves sensibles (tokens, cookies, auth...) saneadas.
    steps: { type: Schema.Types.Mixed },
    state: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Auto-borrado a los 30 dias: es info de debug, no un dato a conservar
// indefinidamente. Ajusta el numero si quieres mas/menos retencion.
workflowErrorLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 }
);

if (mongoose.models.WorkflowErrorLog) {
  delete mongoose.models.WorkflowErrorLog;
}

export default mongoose.model(
  "WorkflowErrorLog",
  workflowErrorLogSchema
);