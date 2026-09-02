import mongoose from "mongoose";

const workflowSessionSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        ownerUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        steps: {
            type: [mongoose.Schema.Types.Mixed],
            required: true,
        },

        currentStep: {
            type: Number,
            required: true,
            default: 0,
        },

        state: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
            default: {},
        },
    },
    {
        timestamps: true,
        collection: "workflow_sessions"
    }
);

if (mongoose.models.WorkflowSession) {
    delete mongoose.models.WorkflowSession;
}

export default mongoose.model(
    "WorkflowSession",
    workflowSessionSchema
);