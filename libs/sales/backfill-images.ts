import type mongoose from "mongoose";
import Sale from "@/models/Sale";
import { getItemImageUrlFromEmail } from "@/libs/gmail-api";

interface BackfillResult {
  checked: number;
  updated: number;
}

export async function backfillMissingSaleImagesFromGmail(
  gmail: unknown,
  userId: mongoose.Types.ObjectId,
  limit = 40
): Promise<BackfillResult> {
  const sales = await Sale.find({
    userId,
    isManual: { $ne: true },
    emailId: { $exists: true, $ne: "" },
    $or: [
      { itemImageUrl: { $exists: false } },
      { itemImageUrl: null },
      { itemImageUrl: "" },
    ],
  })
    .select("_id emailId labelMessageId")
    .limit(limit)
    .lean();

  if (sales.length === 0) {
    return { checked: 0, updated: 0 };
  }

  console.log(`🖼️ Rellenando imágenes de ${sales.length} ventas desde Gmail...`);

  let updated = 0;

  for (const sale of sales) {
    const messageIds = [sale.emailId, sale.labelMessageId].filter(Boolean) as string[];
    let itemImageUrl: string | undefined;

    for (const messageId of messageIds) {
      itemImageUrl = await getItemImageUrlFromEmail(gmail, messageId);
      if (itemImageUrl) break;
    }

    if (itemImageUrl) {
      await Sale.updateOne({ _id: sale._id }, { $set: { itemImageUrl } });
      updated++;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`🖼️ Imágenes actualizadas: ${updated}/${sales.length}`);

  return { checked: sales.length, updated };
}
