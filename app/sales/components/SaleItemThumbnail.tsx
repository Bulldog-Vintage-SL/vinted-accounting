import { Package } from "lucide-react";

interface SaleItemThumbnailProps {
  itemName: string;
  itemImageUrl?: string | null;
  size?: "sm" | "md";
}

export function SaleItemThumbnail({
  itemName,
  itemImageUrl,
  size = "md",
}: SaleItemThumbnailProps) {
  const dimensions = size === "sm" ? "w-10 h-10" : "w-14 h-14";

  if (itemImageUrl) {
    return (
      <img
        src={itemImageUrl}
        alt={itemName}
        className={`${dimensions} rounded-lg object-cover border border-gray-200 shrink-0 bg-gray-50`}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`${dimensions} rounded-lg border border-dashed border-gray-200 bg-gray-50 shrink-0 flex items-center justify-center`}
      aria-hidden
    >
      <Package className="w-5 h-5 text-gray-300" />
    </div>
  );
}
