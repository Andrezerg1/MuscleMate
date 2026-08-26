import { Camera, Cpu, MessageSquare } from "lucide-react";

const steps = [
  {
    icon: Camera,
    title: "Capture",
    description: "Aponte a câmera para o seu movimento.",
  },
  {
    icon: Cpu,
    title: "Analise",
    description: "Os ângulos das articulações são calculados em tempo real.",
  },
  {
    icon: MessageSquare,
    title: "Corrija",
    description: "Receba orientação visual e por voz a cada repetição.",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-20 md:py-28 border-y border-border/70 bg-card/20">
      <div className="container mx-auto px-5 md:px-6">
        <div className="max-w-xl mb-10 md:mb-14">
          <p className="eyebrow mb-3">Experiência orientada</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold">Sua técnica, traduzida em decisões simples.</h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step, i) => (
            <div key={i} className="relative surface rounded-2xl p-6 md:p-7">
              <span className="mb-7 flex h-9 w-9 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-xs font-bold text-primary">0{i + 1}</span>
              <step.icon className="w-6 h-6 text-primary mb-5" />
              <h3 className="font-display text-lg font-bold mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
