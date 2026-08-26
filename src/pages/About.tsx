import { motion } from "framer-motion";
import { BookOpen, Target, Users, Code2 } from "lucide-react";

const AboutPage = () => {
  return (
    <main className="pt-28 pb-20">
      <div className="container mx-auto px-6 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="eyebrow mb-3">Tecnologia aplicada ao treino</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-8">Movimento melhor entendido, treino melhor conduzido.</h1>

          <div className="prose prose-invert max-w-none space-y-8">
            <div className="surface rounded-2xl p-6 md:p-7">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold mb-2">Problema de Pesquisa</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Erros de execução em exercícios de musculação são uma das principais causas de lesões em academias — 
                    sobretudo em praticantes iniciantes sem acesso constante a um personal trainer. A correção em tempo real 
                    exige presença humana especializada, o que representa uma barreira de custo e acesso.
                  </p>
                </div>
              </div>
            </div>

            <div className="surface rounded-2xl p-6 md:p-7">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold mb-2">Contribuição Original</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Desenvolvimento, implementação e avaliação de um sistema de análise biomecânica em tempo real 
                    para exercícios de musculação, com feedback corretivo automatizado baseado em ângulos articulares — 
                    com avaliação de acurácia e usabilidade por praticantes e profissionais de educação física.
                  </p>
                </div>
              </div>
            </div>

            <div className="surface rounded-2xl p-6 md:p-7">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Code2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold mb-2">Stack Tecnológica</h2>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {[
                      { tech: "MediaPipe Pose", desc: "Estimativa de pose (33 landmarks)" },
                      { tech: "OpenCV", desc: "Captura e processamento de vídeo" },
                      { tech: "NumPy", desc: "Cálculo de ângulos articulares" },
                      { tech: "React + TypeScript", desc: "Interface web responsiva" },
                    ].map((item) => (
                      <div key={item.tech} className="rounded-xl border border-border/60 bg-muted/50 p-3.5">
                        <p className="text-sm font-semibold">{item.tech}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="surface rounded-2xl p-6 md:p-7">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold mb-2">Metodologia de Avaliação</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    Duas dimensões obrigatórias: Acurácia Técnica (matriz de confusão, F1-Score por exercício) 
                    e Usabilidade Percebida (SUS + TAM simplificado + questões abertas).
                  </p>
                  <p className="text-xs text-primary font-mono">Meta: Accuracy {">"} 80% por exercício</p>
                </div>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              FATEC Ourinhos — Análise e Desenvolvimento de Sistemas · 2026
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  );
};

export default AboutPage;
