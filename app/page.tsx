import { Suspense, FC } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Problem from "@/components/Problem";
import FeaturesAccordion from "@/components/FeaturesAccordion";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Home: FC = () => {
  return (
    <>
      <Suspense>
        <Header />
      </Suspense>

      <main>
        <Hero />
        <Problem />
        <FeaturesAccordion />
        <FAQ />
        <CTA />
      </main>

      <Footer />
    </>
  );
};

export default Home;
