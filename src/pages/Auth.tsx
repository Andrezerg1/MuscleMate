import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, ArrowRight, Loader2, MailCheck, UserRound } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const signUpSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome completo").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(72),
});

const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(1, "Informe sua senha").max(72),
});

const AuthPage = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { user, enterGuest } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/analise", { replace: true });
  }, [user, navigate]);

  const handleGuestAccess = () => {
    enterGuest();
    navigate("/analise", { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "forgot") {
        const parsed = z.string().trim().email("E-mail inválido").max(255).safeParse(email);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const redirectTo = new URL(`${import.meta.env.BASE_URL}redefinir-senha`, window.location.origin).href;
        const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo });
        if (error) {
          toast.error("Não foi possível enviar o e-mail de recuperação.");
          return;
        }
        setEmailSent(true);
        toast.success("Enviamos as instruções para redefinir sua senha.");
      } else if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ fullName, email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href,
            data: { full_name: parsed.data.fullName },
          },
        });
        if (error) {
          toast.error(
            error.message.includes("already registered")
              ? "Este e-mail já possui uma conta."
              : error.message
          );
          return;
        }
        if (!data.session) {
          setEmailSent(true);
          toast.success("Conta criada! Confirme seu e-mail para entrar.");
        }
      } else {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) {
          toast.error("E-mail ou senha inválidos.");
          return;
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen pt-28 pb-16">
      <div className="container mx-auto px-5 max-w-md">
        <div className="surface rounded-3xl p-6 sm:p-8">
        <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"><Activity className="h-5 w-5" /></div>
        <p className="eyebrow mb-3">Sua área de treino</p>
        <h1 className="font-display text-3xl font-bold mb-2">
          {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha"}
        </h1>
        <p className="text-sm text-muted-foreground mb-7">
          {mode === "forgot" ? "Digite seu e-mail para receber um link de recuperação." : "Salve seus treinos e acompanhe sua evolução."}
        </p>

        {mode !== "forgot" && <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-secondary/60 p-1 mb-6">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setEmailSent(false);
              }}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "login" ? "Login" : "Cadastro"}
            </button>
          ))}
        </div>}

        {emailSent ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm text-muted-foreground">
            <MailCheck className="mb-3 h-6 w-6 text-primary" />
            Enviamos {mode === "forgot" ? "um link de recuperação" : "um link de confirmação"} para <span className="text-foreground">{email}</span>.
            {mode === "forgot" ? " Abra o e-mail para criar uma nova senha." : " Confirme para acessar sua conta."}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome completo"
                maxLength={100}
                autoComplete="name"
                className="w-full rounded-xl border border-border bg-background/40 px-4 py-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              maxLength={255}
              autoComplete="email"
              className="w-full rounded-xl border border-border bg-background/40 px-4 py-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
            {mode !== "forgot" && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                maxLength={72}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-xl border border-border bg-background/40 px-4 py-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            )}
            {mode === "login" && (
              <button type="button" onClick={() => { setMode("forgot"); setEmailSent(false); }} className="block text-sm font-semibold text-primary hover:underline">
                Esqueci minha senha
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-display font-bold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"} {!submitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        )}
        {mode === "forgot" && (
          <button type="button" onClick={() => { setMode("login"); setEmailSent(false); }} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar para o login
          </button>
        )}</div>
        {mode === "login" && !emailSent && (
          <button
            type="button"
            onClick={handleGuestAccess}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <UserRound className="h-4 w-4" />
            Usar como visitante
          </button>
        )}
        {mode === "login" && !emailSent && (
          <p className="mt-3 text-center text-xs text-muted-foreground">Sem cadastro, seus treinos não serão salvos no histórico.</p>
        )}
      </div>
    </main>
  );
};

export default AuthPage;
