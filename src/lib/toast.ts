import { toast as sonnerToast } from "sonner";
import { mensagemErro } from "@/lib/mensagem-erro";

type ToastMessage = Parameters<typeof sonnerToast.error>[0];

function mensagemVisivel(message: ToastMessage): ToastMessage {
  return typeof message === "string" ? mensagemErro(message) : message;
}

const chamarToast = ((
  ...args: Parameters<typeof sonnerToast>
): ReturnType<typeof sonnerToast> => sonnerToast(...args)) as typeof sonnerToast;

export const toast = Object.assign(chamarToast, sonnerToast, {
  error: ((
    message: ToastMessage,
    ...args: Parameters<typeof sonnerToast.error> extends [unknown, ...infer Rest] ? Rest : never
  ) => sonnerToast.error(mensagemVisivel(message), ...args)) as typeof sonnerToast.error,
});