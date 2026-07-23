import Image from "next/image";
import ButtonLead from "@/components/ButtonLead";
import config from "@/config";
import logo from "@/app/icon.png";

const CTA = () => {
  return (
    <section className="relative overflow-hidden min-h-[70vh] bg-brand-black flex items-center justify-center">
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none">
        <Image
          src={logo}
          alt=""
          aria-hidden
          className="w-[min(80vw,520px)] h-auto object-contain"
          priority={false}
        />
      </div>

      <div className="relative z-10 text-center text-neutral-content p-8 max-w-2xl mx-auto">
        <div className="flex justify-center mb-8">
          <Image
            src={logo}
            alt={`${config.appName} logo`}
            width={120}
            height={120}
            className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
          />
        </div>

        <h2 className="font-bold text-3xl md:text-5xl tracking-tight mb-8 md:mb-12">
          Mejora tu negocio de reventa
        </h2>
        <p className="text-lg opacity-80 mb-12 md:mb-16">
          No más líos con Excel, no más pérdidas de dinero.
        </p>

        <ButtonLead extraStyle="items-center" />
      </div>
    </section>
  );
};

export default CTA;
