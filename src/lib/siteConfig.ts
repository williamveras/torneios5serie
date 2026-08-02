/**
 * Configuração por instalação (VPS / deploy).
 *
 * Duas formas de configurar (a segunda tem prioridade):
 *
 * 1) .env ANTES do build (precisa rodar `npm run build` depois de editar):
 *      VITE_PUBLIC_ORG_ID="uuid-da-organizacao"
 *      VITE_SITE_NAME="Torneios Fulano"
 *
 * 2) Arquivo público /site-config.json (NÃO precisa rebuild, basta editar e
 *    recarregar a página). Fica em `public/site-config.json` no código e em
 *    `dist/site-config.json` no servidor:
 *      { "orgId": "uuid-da-organizacao", "siteName": "Torneios Fulano" }
 *
 * Se nenhum orgId for definido, a home lista os torneios de todas as organizações.
 */

const envOrgId =
  (import.meta.env.VITE_PUBLIC_ORG_ID as string | undefined)?.trim() || null;
const envSiteName =
  (import.meta.env.VITE_SITE_NAME as string | undefined)?.trim() || "Torneios Quinta Série";

export const siteConfig: { orgId: string | null; siteName: string } = {
  orgId: envOrgId,
  siteName: envSiteName,
};

/** Carrega /site-config.json (se existir) e sobrescreve os valores do .env. */
export async function loadSiteConfig(): Promise<void> {
  try {
    const res = await fetch(`/site-config.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const orgId = typeof json?.orgId === "string" ? json.orgId.trim() : "";
    const siteName = typeof json?.siteName === "string" ? json.siteName.trim() : "";
    if (orgId) siteConfig.orgId = orgId;
    if (siteName) siteConfig.siteName = siteName;
  } catch {
    // arquivo ausente ou inválido: mantém os valores do .env
  }
}

export const getPublicOrgId = () => siteConfig.orgId;
export const getSiteName = () => siteConfig.siteName;
