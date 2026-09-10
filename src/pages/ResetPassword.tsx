import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const ResetPassword = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      toast.error("A nova senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (password !== confirmation) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error("O link expirou ou não foi possível alterar a senha.");
      setSubmitting(false);
      return;
    }

    await signOut();
    toast.success("Senha redefinida. Entre novamente com sua nova senha.");
    navigate("/auth", { replace: true });
  };

  if (loading) {
    return <main className="min-h-screen pt-32"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></main>;
  }

  return (
    <main className="min-h-screen pt-28 pb-16">
      <div className="container mx-auto max-w-md px-5">
        <div className="surface rounded-3xl p-6 sm:p-8">
          <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
            <KeyRound className="h-5 w-5" />
          </div>
          <p className="eyebrow mb-3">Segurança da conta</p>
          <h1 className="font-display text-3xl font-bold">Criar nova senha</h1>
          <p className="mb-7 mt-2 text-sm text-muted-foreground">Escolha uma senha com pelo menos 6 caracteres.</p>

          {user ? (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nova senha" maxLength={72} autoComplete="new-password" className="w-full rounded-xl border border-border bg-background/40 px-4 py-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/10" />
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirmar nova senha" maxLength={72} autoComplete="new-password" className="w-full rounded-xl border border-border bg-background/40 px-4 py-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/10" />
              <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-display font-bold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5 disabled:opacity-50">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Redefinir senha
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
              Este link é inválido ou expirou. <Link to="/auth" className="font-semibold text-primary hover:underline">Solicite um novo link</Link>.
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default ResetPassword;
