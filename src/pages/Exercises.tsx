import { motion } from "framer-motion";
import { exercises } from "@/lib/exercises";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ExercisesPage = () => {
  return (
    <main className="pt-28 pb-20">
      <div className="container mx-auto px-5 md:px-6 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <p className="eyebrow mb-3">Biblioteca de movimento</p>
          <h1 className="font-display text-3xl md:text-5xl font-bold mb-3">Exercícios e critérios de leitura.</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Toque em um exercício para ver os critérios de execução.
          </p>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {exercises.map((exercise) => (
            <AccordionItem
              key={exercise.id}
              value={exercise.id}
              className="surface rounded-2xl px-5"
            >
              <AccordionTrigger className="py-4 hover:no-underline">
                <div className="text-left">
                  <p className="font-display text-base font-bold">{exercise.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {exercise.angleRange.joint} · {exercise.angleRange.min}°–{exercise.angleRange.max}°
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-5 space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {exercise.description}
                </p>

                <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                  <p className="text-xs font-semibold mb-1">Execução correta</p>
                  <p className="text-xs text-muted-foreground">{exercise.correctCriteria}</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold">Erros comuns</p>
                  {exercise.commonErrors.map((err, j) => (
                    <p key={j} className="text-xs text-muted-foreground">
                      {err.error} → <span className="text-primary">{err.feedback}</span>
                    </p>
                  ))}
                </div>

                <Link
                  to="/analise"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-primary"
                >
                  Analisar este exercício <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </main>
  );
};

export default ExercisesPage;
