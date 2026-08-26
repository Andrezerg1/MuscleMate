import { Activity } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="border-t border-border/70 py-9">
    <div className="container mx-auto px-5 md:px-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <Activity className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
        <span className="font-display font-extrabold text-sm">MuscleMate</span>
      </div>
      <div className="flex gap-5 text-sm font-medium text-muted-foreground">
        <Link to="/exercicios" className="hover:text-primary transition-colors">Exercícios</Link>
        <Link to="/analise" className="hover:text-primary transition-colors">Análise</Link>
        <Link to="/sobre" className="hover:text-primary transition-colors">Sobre</Link>
      </div>
    </div>
  </footer>
);

export default Footer;
