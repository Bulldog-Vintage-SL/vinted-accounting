import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import UploadJob from "@/models/UploadJob";
import Listing from "@/models/Listing";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

interface UploadJobAccountInput {
    accountId?: string;
    platform?: string;
}

interface UploadJobCreateBody {
    listingId?: string;
    accounts?: UploadJobAccountInput[];
    scheduledAt?: string;
}

function validateUploadJobFields(body: UploadJobCreateBody): string | null {
    if (!body.listingId || typeof body.listingId !== "string") {
        return "Falta el producto a publicar";
    }
    if (!mongoose.Types.ObjectId.isValid(body.listingId)) {
        return "listingId no válido";
    }

    if (!Array.isArray(body.accounts) || body.accounts.length === 0) {
        return "Selecciona al menos una cuenta destino";
    }
    const hasInvalidAccount = body.accounts.some(
        (a) => !a?.accountId || !a?.platform
    );
    if (hasInvalidAccount) {
        return "Cada cuenta necesita accountId y platform";
    }

    if (!body.scheduledAt) {
        return "Falta la fecha y hora de publicación";
    }
    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
        return "scheduledAt no es una fecha válida";
    }
    if (scheduledAt.getTime() <= Date.now()) {
        return "scheduledAt debe ser una fecha futura";
    }

    return null;
}

export async function GET(req: Request) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        await connectMongo();

        const { searchParams } = new URL(req.url);
        const due = searchParams.get("due") === "true";

        if (!due) {
            const jobs = await UploadJob.find({ userId })
                .sort({ scheduledAt: 1 })
                .populate("listingId", "title photoUrl");
            return NextResponse.json(jobs);
        }

        const claimedJobs = [];
        let job;
        while (
            (job = await UploadJob.findOneAndUpdate(
                {
                    userId,
                    status: "pending",
                    scheduledAt: { $lte: new Date() },
                },
                {
                    $set: { status: "processing", claimedAt: new Date() },
                },
                {
                    sort: { scheduledAt: 1 },
                    new: true,
                }
            ))
        ) {
            claimedJobs.push(job);
        }

        return NextResponse.json(claimedJobs);
    } catch (err) {
        console.error("Error obteniendo upload jobs:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 400 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const body: UploadJobCreateBody = await req.json();

        const validationError = validateUploadJobFields(body);
        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

        await connectMongo();

        // El listing tiene que existir y pertenecer al usuario autenticado.
        const listing = await Listing.findOne({
            _id: body.listingId,
            userId,
        }).select("_id");

        if (!listing) {
            return NextResponse.json(
                { error: "Producto no encontrado" },
                { status: 404 }
            );
        }

        const job = await UploadJob.create({
            userId: new mongoose.Types.ObjectId(userId),
            listingId: listing._id,
            accounts: body.accounts,
            scheduledAt: new Date(body.scheduledAt as string),
            status: "pending",
        });

        return NextResponse.json(job, { status: 201 });
    } catch (err) {
        console.error("Error creando upload job:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 400 }
        );
    }
}