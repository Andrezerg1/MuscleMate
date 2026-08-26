import { motion } from "framer-motion";
import { Activity, ArrowRight, ScanLine } from "lucide-react";
import { Link } from "react-router-dom";
import heroMotionAnalysis from "@/assets/hero-motion-analysis.png";

const Hero = () => {
  return (
    <section className="relative min-h-[88vh] flex items-center overflow-hidden">
      <img
        src={heroMotionAnalysis}
        alt="Atleta em agachamento com análise de pontos articulares"
        className="absolute inset-0 h-full w-full object-cover object-[67%_center] opacity-50"
      />
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/45 via-transparent to-background/30" />

      <div className="container relative z-10 mx-auto px-5 md:px-6 pt-28 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <div className="eyebrow mb-5">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_5px_hsl(163_82%_54%_/_0.12)]" />
            Inteligência de movimento
          </div>
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.04] mb-6 tracking-tight">
            Treine com uma leitura <span className="text-primary">mais precisa</span> do seu movimento.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mb-9 leading-relaxed">
            Análise postural em tempo real, feita para você enxergar a técnica, ajustar com confiança e evoluir a cada série.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/analise"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-display font-bold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5"
            >
              Iniciar análise
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/exercicios"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/80 px-6 py-4 font-display font-bold text-secondary-foreground transition-colors hover:bg-secondary"
            >
              Ver exercícios
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><ScanLine className="h-4 w-4 text-primary" /> Feedback instantâneo</span>
            <span className="inline-flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Análise por articulação</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
