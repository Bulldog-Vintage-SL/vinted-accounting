import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Sale from "@/models/Sale";
import Listing from "@/models/Listing";
import User from "@/models/User";
import {
  buildListingImageLookup,
  resolveSaleImageUrl,
} from "@/libs/sales/images";

export const dynamic = "force-dynamic";

// GET - Obtener todas las ventas del usuario desde MongoDB (SIN LÍMITE)
export async function GET(req: NextRequest) {
  try {
    const { verifyUserSession } = await import("@/libs/auth-helpers");
    const authResult = await verifyUserSession();

    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;

    // Obtener parámetros de consulta
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // "pending", "completed", "all"
    const startDate = searchParams.get("startDate"); // ISO date string
    const endDate = searchParams.get("endDate"); // ISO date string

    // Construir query
    const query: any = { userId: user._id };
    
    if (status && status !== "all") {
      query.status = status;
    }

    // Filtrar por rango de fechas si se proporciona
    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) {
        query.saleDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.saleDate.$lte = new Date(endDate);
      }
    }

    // Obtener TODAS las ventas sin límite
    const sales = await Sale.find(query)
      .sort({ saleDate: -1 })
      .lean();

    const listings = await Listing.find({ userId: user._id })
      .select("title photoUrl")
      .lean();
    const listingImageLookup = buildListingImageLookup(listings);

    const enrichedSales = sales.map((sale) => ({
      ...sale,
      itemImageUrl: resolveSaleImageUrl(sale, listingImageLookup),
    }));

    const total = enrichedSales.length;

    // Calcular estadísticas
    const stats = await Sale.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const pendingStats = stats.find((s) => s._id === "pending") || { count: 0, totalAmount: 0 };
    const completedStats = stats.find((s) => s._id === "completed") || { count: 0, totalAmount: 0 };

    return NextResponse.json({
      sales: enrichedSales,
      total,
      stats: {
        pending: pendingStats,
        completed: completedStats,
        total: {
          count: pendingStats.count + completedStats.count,
          totalAmount: pendingStats.totalAmount + completedStats.totalAmount,
        },
      },
    });
  } catch (error: any) {
    console.error("Error getting sales:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get sales" },
      { status: 500 }
    );
  }
}
