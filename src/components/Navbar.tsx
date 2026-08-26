import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    setMobileOpen(false);
    navigate("/");
  };

  const links = [
    { to: "/", label: "Início" },
    { to: "/exercicios", label: "Exercícios" },
    { to: "/analise", label: "Análise" },
    { to: "/sobre", label: "Sobre" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/70 bg-background/75 backdrop-blur-2xl">
      <div className="container mx-auto px-5 md:px-6 flex items-center justify-between h-[4.5rem]">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-[var(--shadow-glow)]">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-[17px] font-extrabold tracking-tight">MuscleMate</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
            className={`relative px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                location.pathname === link.to
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {location.pathname === link.to && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className="relative z-10">{link.label}</span>
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="w-4 h-4" /> Sair
            </button>
          ) : null}
          <Link
            to={user ? "/analise" : "/auth"}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5"
          >
            {user ? "Iniciar Análise" : "Entrar"}
          </Link>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-foreground">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden border-t border-border bg-background/95 px-5 py-4 space-y-2 backdrop-blur-2xl"
        >
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={`block px-4 py-2 rounded-lg text-sm font-medium ${
                location.pathname === link.to
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground"
            >
              Sair
            </button>
          ) : (
            <Link
              to="/auth"
              onClick={() => setMobileOpen(false)}
              className="block px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground text-center"
            >
              Entrar
            </Link>
          )}
        </motion.div>
      )}
    </nav>
  );
};

export default Navbar;
