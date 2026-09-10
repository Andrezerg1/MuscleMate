import { useEffect, useRef, useState } from "react";
import { Camera, KeyRound, Loader2, Mail, Phone, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const fieldClass = "w-full rounded-xl border border-border bg-background/40 px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60";

const Profile = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (error) toast.error("Não foi possível carregar o perfil.");
      setName(data?.full_name || user.user_metadata.full_name || "");
      setPhone(data?.phone || "");
      setAvatarUrl(data?.avatar_url || user.user_metadata.avatar_url || "");
      setEmail(user.email || "");
      setLoading(false);
    };

    void loadProfile();
  }, [user]);

  const initials = (name || email || "U")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const handleAvatarUpload = async (file?: File) => {
    if (!file || !user) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast.error("Escolha uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setUploading(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/profile.${extension}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: url, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.updateUser({ data: { avatar_url: url } });
      if (authError) throw authError;
      setAvatarUrl(url);
      toast.success("Foto de perfil atualizada.");
    } catch {
      toast.error("Não foi possível atualizar a foto.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (trimmedName.length < 2) {
      toast.error("Informe um nome de usuário válido.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      toast.error("A nova senha deve ter ao menos 6 caracteres.");
      return;
    }

    setSaving(true);
    try {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: trimmedName,
        phone: phone.trim() || null,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw profileError;

      const authUpdates: { email?: string; password?: string; data: { full_name: string } } = {
        data: { full_name: trimmedName },
      };
      if (trimmedEmail !== user.email) authUpdates.email = trimmedEmail;
      if (newPassword) authUpdates.password = newPassword;
      const { error: authError } = await supabase.auth.updateUser(authUpdates);
      if (authError) throw authError;

      setNewPassword("");
      toast.success(trimmedEmail !== user.email ? "Perfil salvo. Confirme o novo e-mail para concluir a alteração." : "Perfil atualizado.");
    } catch {
      toast.error("Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="min-h-screen pt-32"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></main>;
  }

  return (
    <main className="min-h-screen pt-28 pb-16">
      <div className="container mx-auto max-w-3xl px-5">
        <p className="eyebrow mb-3">Sua conta</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Meu perfil</h1>
        <p className="mt-2 text-sm text-muted-foreground">Gerencie seus dados de acesso e sua identificação no MuscleMate.</p>

        <form onSubmit={handleSave} className="surface mt-8 overflow-hidden rounded-3xl">
          <div className="flex flex-col items-center gap-5 border-b border-border/70 p-6 sm:flex-row sm:p-8">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-primary/30 bg-secondary">
                <AvatarImage src={avatarUrl} alt={`Foto de ${name}`} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">{initials}</AvatarFallback>
              </Avatar>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="Alterar foto de perfil" className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-60">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void handleAvatarUpload(event.target.files?.[0])} />
            </div>
            <div className="text-center sm:text-left">
              <h2 className="font-display text-xl font-bold">Foto de perfil</h2>
              <p className="mt-1 text-sm text-muted-foreground">JPG, PNG ou WebP de até 5 MB.</p>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="mt-3 text-sm font-semibold text-primary hover:underline">Alterar foto</button>
            </div>
          </div>

          <div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
            <label className="space-y-2 text-sm font-medium">
              <span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /> Usuário</span>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} autoComplete="name" className={fieldClass} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> E-mail</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={255} autoComplete="email" className={fieldClass} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> Telefone <span className="font-normal text-muted-foreground">(opcional)</span></span>
              <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} autoComplete="tel" placeholder="(00) 00000-0000" className={fieldClass} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Nova senha</span>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} maxLength={72} autoComplete="new-password" placeholder="Deixe em branco para manter" className={fieldClass} />
            </label>
          </div>

          <div className="flex justify-end border-t border-border/70 bg-secondary/20 px-6 py-5 sm:px-8">
            <button type="submit" disabled={saving || uploading} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default Profile;
