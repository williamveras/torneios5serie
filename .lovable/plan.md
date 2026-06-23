# Plano: Organizações (multi-tenant)

Hoje todos os torneios aparecem juntos no dashboard. Vamos introduzir o conceito de **Organização** para que cada grupo (ex.: "Torneios Quinta Série") tenha seus próprios torneios, jogadores, links e configurações, isoladamente.

## Conceito

- Uma **Organização** é um espaço isolado (ex.: "Torneios Quinta Série", "Liga Scopas BH").
- Cada **usuário** pode pertencer a uma ou mais organizações, com papéis: `owner`, `admin`, `member`.
- Cada **torneio** pertence a exatamente uma organização.
- O usuário escolhe a organização ativa no topo do app (seletor) e só vê os torneios dela.
- Links públicos (`/inscricao/:token` e `/torneio/:id`) continuam funcionando para qualquer pessoa — eles já são públicos por torneio, então não mudam.

## Mudanças no banco

1. Nova tabela `organizations` (nome, slug, created_by).
2. Nova tabela `organization_members` (organization_id, user_id, role) — fonte da verdade de quem pode acessar o quê. Roles via enum, seguindo o padrão seguro (separado de `profiles`).
3. Coluna `organization_id` em `tournaments` (NOT NULL após migração).
4. Função `has_org_role(_user, _org, _role)` `SECURITY DEFINER` para usar nas policies sem recursão.
5. **Migração de dados existentes:** criar uma organização padrão "Torneios Quinta Série", mover todos os torneios atuais para ela, e adicionar todos os usuários existentes como `member` (o primeiro usuário criado vira `owner`).
6. Atualizar RLS de `tournaments` (e tabelas dependentes via `tournament_id`) para exigir que o usuário seja membro da organização do torneio.

Os links públicos continuam usando RPCs `SECURITY DEFINER` (`validate_registration_token`, `get_players_public`, etc.), então não são afetados pelo RLS novo.

## Mudanças no frontend

1. **Seletor de organização** no topo do `Dashboard`: dropdown com as orgs do usuário + botão "Nova organização" + botão "Convidar membro" (gera link/usa email).
2. Persistir a org ativa em `localStorage` (`activeOrgId`).
3. `Dashboard.fetchTournaments` filtra por `organization_id = activeOrgId`.
4. `handleCreate` de torneio passa `organization_id: activeOrgId`.
5. Tela simples de **gerenciar membros** da organização (listar, mudar papel, remover) — acessível só para `owner`/`admin`.
6. Quando um novo usuário se cadastra sem convite, criar automaticamente uma organização pessoal pra ele (ex.: "Organização de {nome}") para que o dashboard não fique vazio.

## Convites

Versão simples nesta primeira iteração: o `owner`/`admin` adiciona um membro pelo **email** do usuário já cadastrado. Se quiser convite por link (para usuários ainda não cadastrados), faço numa segunda etapa.

## Detalhes técnicos

- Enum: `create type public.org_role as enum ('owner','admin','member');`
- Tabela `organization_members(org_id, user_id, role)` com unique `(org_id,user_id)`.
- Função:
  ```sql
  create function public.is_org_member(_org uuid, _user uuid)
  returns boolean language sql stable security definer set search_path=public as $$
    select exists(select 1 from public.organization_members
                  where organization_id=_org and user_id=_user);
  $$;
  ```
- RLS em `tournaments`:
  - SELECT/INSERT/UPDATE/DELETE: `public.is_org_member(organization_id, auth.uid())`
  - INSERT exige também que `auth.uid()` seja membro da org passada.
- GRANTs explícitos em todas as tabelas novas (`authenticated` + `service_role`; sem `anon`).
- Migração de dados num único bloco transacional para não quebrar o app entre passos.

## Fora do escopo desta etapa

- Convidar usuário ainda não cadastrado por email/link (faço depois se quiser).
- Branding por organização (logo/título customizado nas páginas públicas).
- Cobrança/limites por organização.

Posso seguir com a implementação?