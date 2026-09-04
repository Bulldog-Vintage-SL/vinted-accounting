import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import UploadJob from "@/models/UploadJob";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

interface UploadJobPatchBody {
  status?: string;
  error?: string | null;
  scheduledAt?: string;
}

const VALID_STATUSES = ["pending", "processing", "completed", "failed"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "id no válido" }, { status: 400 });
    }

    const body: UploadJobPatchBody = await req.json();

    if (body.status === undefined && body.scheduledAt === undefined) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `status debe ser uno de: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    let newScheduledAt: Date | null = null;
    if (body.scheduledAt !== undefined) {
      newScheduledAt = new Date(body.scheduledAt);
      if (Number.isNaN(newScheduledAt.getTime())) {
        return NextResponse.json(
          { error: "scheduledAt no es una fecha válida" },
          { status: 400 }
        );
      }
      if (newScheduledAt.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "scheduledAt debe ser una fecha futura" },
          { status: 400 }
        );
      }
    }

    await connectMongo();

    const update: Record<string, unknown> = {};
    if (body.status !== undefined) update.status = body.status;
    if (newScheduledAt) update.scheduledAt = newScheduledAt;

    if (body.status === "completed" || body.status === "failed") {
      update.executedAt = new Date();
    }
    if (body.status === "failed") {
      update.error = body.error ?? "Error desconocido";
    }
    if (body.status === "pending" || body.status === "processing") {
      update.error = null;
    }

    const filter: Record<string, unknown> = { _id: id, userId };
    if (body.status === "processing") {
      // Lock optimista pending -> processing (usado por GET ?due=true)
      filter.status = "pending";
    }
    if (newScheduledAt && body.status === undefined) {
      // Reprogramar solo tiene sentido sobre jobs aún no procesados.
      filter.status = "pending";
    }

    const job = await UploadJob.findOneAndUpdate(filter, update, { new: true });

    if (!job) {
      return NextResponse.json(
        { error: "Job no encontrado, ya procesado, o ya estaba siendo procesado" },
        { status: 409 }
      );
    }

    return NextResponse.json(job);
  } catch (err) {
    console.error("Error actualizando upload job:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "id no válido" }, { status: 400 });
    }

    await connectMongo();

    const job = await UploadJob.findOneAndDelete({ _id: id, userId });

    if (!job) {
      return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("Error eliminando upload job:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    );
  }
}