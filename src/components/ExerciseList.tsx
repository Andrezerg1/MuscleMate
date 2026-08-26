import { motion } from "framer-motion";
import { exercises } from "@/lib/exercises";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const ExerciseList = () => {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-5 md:px-6">
        <div className="mb-8 md:mb-12">
          <p className="eyebrow mb-3">Biblioteca de movimento</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">Exercícios prontos para analisar.</h2>
          <p className="text-muted-foreground text-sm md:text-base max-w-md">
            Análise biomecânica com critérios específicos por exercício.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {exercises.map((ex, i) => (
            <motion.div
              key={ex.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(i * 0.05, 0.2) }}
            >
              <Link
                to="/analise"
                className="group flex items-center justify-between gap-4 rounded-2xl surface px-5 py-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-glow)]"
              >
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold truncate">{ex.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {ex.angleRange.joint} · {ex.angleRange.min}°–{ex.angleRange.max}°
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          ))}
        </div>

        <Link
          to="/exercicios"
          className="mt-7 inline-flex items-center gap-2 text-sm text-primary font-bold"
        >
          Ver detalhes <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
};

export default ExerciseList;
