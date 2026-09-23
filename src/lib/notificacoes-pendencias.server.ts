/**
 * Avisos aos administradores sobre pendências de integração (ERP / Bitrix).
 *
 * Canais: aviso dentro do app (lido pela própria tela), e-mail e WhatsApp.
 * Cada canal só dispara quando estiver configurado e, no máximo, uma vez por
 * hora por destinatário, para não inundar ninguém.
 *
 * Server-only.
 */
import { centralDb } from "./central-db";

const INTERVALO_MIN = 60;

export type Administrador = { id: string; nome: string; email: string | null; telefone: string | null };

/** Administradores ativos do app (perfil `adm`). */
export async function listarAdministradores(): Promise<Administrador[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: papeis } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "adm");
  const ids = (papeis ?? []).map((p) => p.user_id);
  if (ids.length === 0) return [];

  const { data: perfis } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, is_active")
    .in("id", ids);

  const admins: Administrador[] = [];
  for (const perfil of perfis ?? []) {
    if (perfil.is_active === false) continue;
    const { data: usuario } = await supabaseAdmin.auth.admin.getUserById(perfil.id);
    admins.push({
      id: perfil.id,
      nome: perfil.full_name ?? usuario?.user?.email ?? "Administrador",
      email: usuario?.user?.email ?? null,
      telefone: perfil.phone ?? null,
    });
  }
  return admins;
}

async function avisadoRecentemente(canal: "EMAIL" | "WHATSAPP", destinatario: string) {
  const desde = new Date(Date.now() - INTERVALO_MIN * 60_000).toISOString();
  const { data } = await centralDb
    .from("notificacoes_pendencias")
    .select("id")
    .eq("canal", canal)
    .eq("destinatario", destinatario)
    .gte("enviado_em", desde)
    .limit(1);
  return (data ?? []).length > 0;
}

async function registrar(
  canal: "EMAIL" | "WHATSAPP",
  destinatario: string,
  quantidade: number,
  ok: boolean,
  mensagem: string | null,
) {
  try {
    await centralDb
      .from("notificacoes_pendencias")
      .insert({ canal, destinatario, quantidade, ok, mensagem } as never);
  } catch {
    /* registro é complementar */
  }
}

const LINK = "https://speedflow-logistics.lovable.app/pendencias-integracao";

function textoAviso(quantidade: number): string {
  const plural = quantidade === 1 ? "pendência" : "pendências";
  return (
    `SpeedFlow: ${quantidade} ${plural} de integração aguardando solução ` +
    `(lançamento no ERP ou tarefa no Bitrix). O app continua tentando sozinho. ` +
    `Acompanhe em ${LINK}`
  );
}

/* ------------------------------ WhatsApp ------------------------------ */

function whatsappConfigurado(): boolean {
  return Boolean(
    process.env["TWILIO_API_KEY"] &&
      process.env["LOVABLE_API_KEY"] &&
      process.env["TWILIO_WHATSAPP_FROM"],
  );
}

function e164(telefone: string): string | null {
  const so = telefone.replace(/\D/g, "");
  if (so.length < 10) return null;
  return so.startsWith("55") ? `+${so}` : `+55${so}`;
}

async function enviarWhatsapp(telefone: string, texto: string): Promise<void> {
  const destino = e164(telefone);
  if (!destino) throw new Error("Telefone inválido");
  const resp = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
      "X-Connection-Api-Key": process.env["TWILIO_API_KEY"] ?? "",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: `whatsapp:${destino}`,
      From: `whatsapp:${process.env["TWILIO_WHATSAPP_FROM"]}`,
      Body: texto,
    }),
  });
  if (!resp.ok) {
    const corpo = (await resp.text()).slice(0, 300);
    throw new Error(`Twilio ${resp.status}: ${corpo}`);
  }
}

/* -------------------------------- E-mail ------------------------------- */

function emailConfigurado(): boolean {
  return Boolean(process.env["EMAIL_FROM_ADDRESS"]);
}

async function enviarEmail(destino: string, quantidade: number, texto: string): Promise<void> {
  const { sendEmail } = await import("@lovable.dev/email-js");
  await sendEmail({
    from: process.env["EMAIL_FROM_ADDRESS"]!,
    to: destino,
    subject: `SpeedFlow — ${quantidade} pendência(s) de integração`,
    html: `<p>${texto.replace(LINK, `<a href="${LINK}">${LINK}</a>`)}</p>`,
    text: texto,
  } as never);
}

/* ------------------------------- Disparo ------------------------------- */

export async function avisarAdministradores(quantidade: number): Promise<void> {
  if (quantidade <= 0) return;
  const texto = textoAviso(quantidade);
  let admins: Administrador[] = [];
  try {
    admins = await listarAdministradores();
  } catch {
    return;
  }

  for (const admin of admins) {
    if (emailConfigurado() && admin.email && !(await avisadoRecentemente("EMAIL", admin.email))) {
      try {
        await enviarEmail(admin.email, quantidade, texto);
        await registrar("EMAIL", admin.email, quantidade, true, null);
      } catch (e) {
        await registrar("EMAIL", admin.email, quantidade, false, (e as Error).message);
      }
    }
    if (
      whatsappConfigurado() &&
      admin.telefone &&
      !(await avisadoRecentemente("WHATSAPP", admin.telefone))
    ) {
      try {
        await enviarWhatsapp(admin.telefone, texto);
        await registrar("WHATSAPP", admin.telefone, quantidade, true, null);
      } catch (e) {
        await registrar("WHATSAPP", admin.telefone, quantidade, false, (e as Error).message);
      }
    }
  }
}
