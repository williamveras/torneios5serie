
## Sistema de Gerenciamento de Torneios

### Autenticação
- Login simples com email/senha via Supabase Auth
- Tela de login/registro

### Banco de Dados (Supabase)
- **tournaments**: id, nome, data_inicio, created_by
- **players**: id, tournament_id, nome_completo, nick_playroom, whatsapp, preferencia_horarios, comentario
- **match_results**: id, tournament_id, player_id, grupo, rodada, pontos_jogo, pontos_mesa, penalidades (texto, default "Sem penalidades")

### Páginas e Funcionalidades

**1. Dashboard / Lista de Torneios**
- Lista de torneios cadastrados com nome e data
- Botão para criar novo torneio (nome + data de início)
- Clicar num torneio abre a página de gerenciamento

**2. Página do Torneio** (abas ou seções)

**Aba Participantes:**
- Lista dos jogadores inscritos com nome, nick, WhatsApp, preferência de horário
- Botão "Importar Planilha" que aceita arquivo .xlsx/.csv do Google Forms
- O sistema lê as colunas (Nome completo, Nick no Playroom, WhatsApp, Preferência de horários, Comentário adicional) e cadastra todos automaticamente
- Possibilidade de remover jogadores manualmente

**Aba Registrar Resultados:**
- Formulário com: seleção do jogador, grupo, rodada, pontos de jogo, pontos de mesa, penalidades (campo texto opcional)
- Botão "Adicionar resultado do outro jogador" para registrar os 2 jogadores da mesa no mesmo fluxo
- Após preencher o 1º jogador, abre campos para o 2º jogador (mesmo grupo e rodada pré-preenchidos)
- Botão salvar para gravar os dois resultados juntos

**Aba Classificação por Rodada:**
- Filtro por grupo
- Tabela de classificação ordenada por:
  1. Pontos de jogo (maior primeiro)
  2. Pontos de mesa (desempate)
  3. Jogadores com penalidade vão para o final da classificação
- Exibição da posição (1º, 2º, 3º...)
- Botão "Exportar para planilha" que gera arquivo .xlsx com a classificação

### Design
- Interface limpa e funcional com sidebar de navegação
- Cores neutras, estilo profissional
- Responsivo para uso em desktop e mobile
