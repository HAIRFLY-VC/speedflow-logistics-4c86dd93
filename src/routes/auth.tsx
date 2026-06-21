import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable";

async function handleGoogleSignIn() {
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });
  if (result.error) {
    toast.error("Não foi possível iniciar o login com Google");
    return;
  }
  if (result.redirected) return;
  window.location.href = "/dashboard";
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Speed Logística" },
      { name: "description", content: "Acesse o sistema Speed Logística da Hairfly Cosméticos." },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(128),
});

const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, "Informe seu nome").max(100),
});

function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" />;
  }

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (error) {
      toast.error(error === "Invalid login credentials" ? "E-mail ou senha incorretos" : error);
      return;
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard" });
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
      fullName: form.get("fullName"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(parsed.data.email, parsed.data.password, parsed.data.fullName);
    setSubmitting(false);
    if (error) {
      toast.error(
        error.includes("already registered") ? "Este e-mail já está cadastrado" : error,
      );
      return;
    }
    toast.success("Conta criada! Um administrador precisa atribuir seu papel para liberar o acesso.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="rounded-lg bg-primary p-2 text-primary-foreground">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Speed Logística</h1>
            <p className="text-xs text-muted-foreground">Hairfly Cosméticos</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Acessar o sistema</CardTitle>
            <CardDescription>Entre com seu e-mail corporativo</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="w-full mb-4"
              onClick={handleGoogleSignIn}
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16.3 4.5 9.7 8.8 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 43.5c5.4 0 10.3-2.1 14-5.4l-6.5-5.3c-2 1.4-4.6 2.3-7.5 2.3-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.2 16.2 43.5 24 43.5z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.3c-.5.4 7-5.1 7-15 0-1.2-.1-2.4-.4-3.5z"/>
              </svg>
              Entrar com Google
            </Button>
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="si-email">E-mail</Label>
                    <Input id="si-email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-password">Senha</Label>
                    <Input
                      id="si-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Nome completo</Label>
                    <Input id="su-name" name="fullName" type="text" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">E-mail</Label>
                    <Input id="su-email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">Senha</Label>
                    <Input
                      id="su-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Criando..." : "Criar conta"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Após criar a conta, um administrador precisa atribuir seu papel.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
