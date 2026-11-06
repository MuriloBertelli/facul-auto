# Navegador/MCP nesta continuação local

Verificado em 05/11/2026. A conexão oficial de controle do navegador disponível
nesta conversa é `cua_repl`, com navegador interno e superfícies MCP Apps.
O inventário inicial não mostrou abas, mas abrir os endereços oficiais
reutilizou com sucesso as sessões autenticadas do Supabase e do Netlify.

- Netlify: `https://app.netlify.com/teams/liro-ftl8xk/projects`.
- Supabase: `https://supabase.com/dashboard`.
- CampusFlow local: `http://127.0.0.1:8888`.
- CampusFlow publicado: `https://campusflow-murilobertelli.netlify.app`.

Não foram extraídos cookies, senhas, perfis ou tokens do navegador, e não foi
presumida conexão por extensões/CDP. Senhas novas e a conclusão de etapas de
credencial devem ser feitas pelo usuário no formulário seguro preparado.

Os arquivos do launcher Playwright MCP citados na tarefa de nuvem não vieram
nesta extração. Nenhuma configuração global do Codex foi sobrescrita e nenhum
caminho `/workspace` foi registrado como caminho local de MCP. Não é preciso
instalar outro MCP para a conexão oficial que já funcionou nesta sessão.

O Playwright fixado no lockfile do projeto é usado por `npm run test:e2e` e
não equivale a uma conexão MCP às abas pessoais. Os seis testes locais foram
executados com sucesso usando Chromium instalado neste computador.

Retomada, evidências e pendências em [CONTINUAR_LOCAL.md](CONTINUAR_LOCAL.md).
