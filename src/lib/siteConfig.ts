/**
 * Configuração por instalação (VPS / deploy).
 *
 * Defina estas variáveis no arquivo .env do servidor antes do build:
 *
 *   VITE_PUBLIC_ORG_ID="uuid-da-organizacao"   # filtra a home para 1 organização
 *   VITE_SITE_NAME="Torneios Fulano"           # nome exibido no site público
 *
 * Se VITE_PUBLIC_ORG_ID ficar vazio, a home lista os torneios de todas as organizações.
 */
export const PUBLIC_ORG_ID: string | null =
  (import.meta.env.VITE_PUBLIC_ORG_ID as string | undefined)?.trim() || null;

export const SITE_NAME: string =
  (import.meta.env.VITE_SITE_NAME as string | undefined)?.trim() || "Torneios Quinta Série";
