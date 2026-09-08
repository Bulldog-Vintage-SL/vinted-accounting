import { Chat } from "../types";

const PLATFORM_STYLES: Record<Chat["platform"], { label: string; className: string }> = {
  vinted: { label: "Vinted", className: "bg-teal-100 text-teal-700" },
  wallapop: { label: "Wallapop", className: "bg-lime-100 text-lime-700" },
  depop: { label: "Depop", className: "bg-red-100 text-red-700" },
  vestiaire: { label: "Vestiaire", className: "bg-purple-100 text-purple-700" },
  shopify: { label: "Shopify", className: "bg-green-100 text-green-700" },
};

export function PlatformBadge({ platform }: { platform: Chat["platform"] }) {
  const style = PLATFORM_STYLES[platform];
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${style.className}`}
    >
      {style.label}
    </span>
  );
}