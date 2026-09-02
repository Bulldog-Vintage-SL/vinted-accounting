import { PLATFORM_ICONS, formatPlatformName } from "@/libs/inventory/display";

interface PlatformLogosProps {
  platforms: string[];
  size?: "sm" | "md";
}

const SIZE_CLASS = {
  sm: "h-6 w-6",
  md: "h-7 w-7",
} as const;

export function PlatformLogos({ platforms, size = "sm" }: PlatformLogosProps) {
  if (platforms.length === 0) {
    return <span className="text-gray-400">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {platforms.map((platform) => {
        const icon = PLATFORM_ICONS[platform];
        const label = formatPlatformName(platform);

        if (!icon) {
          return (
            <span
              key={platform}
              className="text-[10px] font-semibold text-gray-700"
              title={label}
            >
              {label.slice(0, 3)}
            </span>
          );
        }

        return (
          <img
            key={platform}
            src={icon}
            alt={label}
            title={label}
            className={`${SIZE_CLASS[size]} rounded-md bg-white object-contain`}
          />
        );
      })}
    </div>
  );
}
