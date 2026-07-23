import TestimonialsAvatars from "./TestimonialsAvatars";
import config from "@/config";
import ButtonCheckout from "@/components/ButtonCheckout";
import { HeroLogoShowcase } from "./HeroLogoShowcase";

const Hero = () => {
  return (
    <section className="max-w-7xl mx-auto bg-base-100 flex flex-col lg:flex-row items-center justify-center gap-16 lg:gap-20 px-8 py-8 lg:py-20">
      <div className="flex flex-col gap-10 lg:gap-14 items-center justify-center text-center lg:text-left lg:items-start">
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary/15 px-4 py-1.5 text-sm font-semibold text-secondary">
          Academia Nº1 Reventa
        </div>

        <h1 className="font-extrabold text-4xl lg:text-6xl tracking-tight md:-mb-4">
          Deja de adivinar tus ganancias.
        </h1>
        <p className="text-lg opacity-80 leading-relaxed">
          La plataforma de contabilidad creada exclusivamente para revendedores. Controla cada venta, gasto y beneficio de tu reventa en un solo lugar.
        </p>
        <ButtonCheckout priceId={config.stripe.plans[0].priceId} />

        <TestimonialsAvatars priority={true} />
      </div>

      <div className="lg:w-full flex items-center justify-center overflow-visible">
        <HeroLogoShowcase />
      </div>
    </section>
  );
};

export default Hero;
