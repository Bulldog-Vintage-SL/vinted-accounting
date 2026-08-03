import Image from "next/image";
import config from "@/config";
import logo from "@/app/icon.png";

const FLOATING_ICONS = [
  {
    src: "/icons/vinted.svg",
    alt: "Vinted",
    className: "top-[0%] left-1/2 -translate-x-1/2",
    animation: "animate-[hero-float_3.6s_ease-in-out_infinite]",
    delay: "0s",
  },
  {
    src: "/icons/wallapop.svg",
    alt: "Wallapop",
    className: "top-[14%] right-[4%]",
    animation: "animate-[hero-float-tilt_4.2s_ease-in-out_infinite]",
    delay: "0.4s",
  },
  {
    src: "/icons/depop.jpeg",
    alt: "Depop",
    className: "top-1/2 right-[-2%] -translate-y-1/2",
    animation: "animate-[hero-float_3.9s_ease-in-out_infinite]",
    delay: "0.8s",
  },
  {
    src: "/icons/vestiaire.jpeg",
    alt: "Vestiaire Collective",
    className: "bottom-[10%] right-[6%]",
    animation: "animate-[hero-float-tilt_4.4s_ease-in-out_infinite]",
    delay: "1.1s",
  },
  {
    src: "/icons/shopify.svg",
    alt: "Shopify",
    className: "bottom-[10%] left-[6%]",
    animation: "animate-[hero-float_4.1s_ease-in-out_infinite]",
    delay: "0.6s",
  },
  {
    src: "/icons/ebay.svg",
    alt: "eBay",
    className: "top-1/2 left-[-2%] -translate-y-1/2",
    animation: "animate-[hero-float-tilt_3.8s_ease-in-out_infinite]",
    delay: "1.3s",
  },
] as const;

function FloatingPlatformIcon({
  src,
  alt,
  className,
  animation,
  delay,
}: (typeof FLOATING_ICONS)[number]) {
  return (
    <div
      className={`absolute z-10 ${className} ${animation}`}
      style={{ animationDelay: delay }}
    >
      <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-white/80 bg-white p-2.5 shadow-lg ring-1 ring-black/5">
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </div>
    </div>
  );
}

export function HeroLogoShowcase() {
  return (
    <div className="relative mx-auto flex w-full max-w-[480px] items-center justify-center aspect-square">
      {FLOATING_ICONS.map((icon) => (
        <FloatingPlatformIcon key={icon.src} {...icon} />
      ))}

      <div className="relative z-20 flex aspect-square w-[72%] max-w-[320px] items-center justify-center rounded-full bg-brand-black p-6 shadow-2xl ring-4 ring-primary sm:p-8">
        <Image
          src={logo}
          alt={`${config.appName} logo`}
          priority
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  );
}
