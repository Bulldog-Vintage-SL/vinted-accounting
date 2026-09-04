import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import UploadJob from "@/models/UploadJob";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

interface UploadJobPatchBody {
  status?: string;
  error?: string | null;
}

const VALID_STATUSES = ["pending", "processing", "completed", "failed"];

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "id no válido" }, { status: 400 });
    }

    const body: UploadJobPatchBody = await req.json();

    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `status debe ser uno de: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    await connectMongo();

    const update: Record<string, unknown> = { status: body.status };

    if (body.status === "completed" || body.status === "failed") {
      update.executedAt = new Date();
    }
    if (body.status === "failed") {
      update.error = body.error ?? "Error desconocido";
    }
    if (body.status === "pending" || body.status === "processing") {
      // Reintento manual: limpia el error previo.
      update.error = null;
    }

    // El $ne evita que dos pestañas marquen "processing" a la vez sobre
    // el mismo job: la segunda petición encontrará status ya distinto
    // de "pending" y no hará match si intenta pasar de pending->processing.
    const filter: Record<string, unknown> = { _id: id, userId };
    if (body.status === "processing") {
      filter.status = "pending";
    }

    const job = await UploadJob.findOneAndUpdate(filter, update, {
      new: true,
    });

    if (!job) {
      return NextResponse.json(
        { error: "Job no encontrado o ya estaba siendo procesado" },
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
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = params;
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