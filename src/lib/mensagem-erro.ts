const TRADUCOES: Array<[RegExp, string]> = [
  [
    /password.*(weak|strength|at least|characters|uppercase|lowercase|digit|number|symbol)|weak password/i,
    "A senha é muito fraca. Use letras maiúsculas e minúsculas, números e símbolos.",
  ],
  [/invalid login credentials|invalid credentials/i, "E-mail ou senha incorretos."],
  [/user already registered|already.*registered|already exists/i, "Este e-mail já está cadastrado."],
  [/email.*not confirmed/i, "Confirme seu e-mail antes de entrar."],
  [/email rate limit|rate limit|too many requests/i, "Muitas tentativas. Aguarde alguns minutos e tente novamente."],
  [/session.*(expired|missing)|jwt expired|refresh token/i, "Sua sessão expirou. Entre novamente."],
  [/unauthorized|forbidden|permission denied|not allowed/i, "Você não tem permissão para realizar esta ação."],
  [/failed to fetch|network|fetch failed|connection/i, "Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente."],
  [/invalid email/i, "Informe um e-mail válido."],
];

function textoDoErro(erro: unknown): string {
  if (typeof erro === "string") return erro;
  if (erro instanceof Error) return erro.message;
  if (erro && typeof erro === "object" && "message" in erro) {
    const mensagem = (erro as { message?: unknown }).message;
    return typeof mensagem === "string" ? mensagem : "";
  }
  return "";
}

export function mensagemErro(
  erro: unknown,
  fallback = "Não foi possível concluir a operação. Tente novamente.",
): string {
  const texto = textoDoErro(erro).trim();
  if (!texto) return fallback;

  for (const [padrao, traducao] of TRADUCOES) {
    if (padrao.test(texto)) return traducao;
  }

  // Mensagens já escritas em português podem ser exibidas normalmente.
  if (/[áàâãéêíóôõúç]|\b(não|erro|falha|usuário|senha|email|e-mail|informe|apenas|possível)\b/i.test(texto)) {
    return texto;
  }

  return fallback;
}