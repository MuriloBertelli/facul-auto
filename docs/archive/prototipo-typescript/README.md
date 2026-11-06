# Facul Auto

Organizador pessoal de trabalhos web para o Canvas da faculdade. O projeto reúne uma interface em React, uma API interna no Netlify e persistência com autenticação no Supabase. Ele ajuda a acompanhar prazos, guardar a URL do trabalho publicado e preparar sua entrega.

Sem configuração do Supabase, a interface funciona em **modo local**, com dados de exemplo identificados e armazenamento no navegador. Esse modo não acessa a faculdade nem comprova uma entrega. Com Supabase e Canvas configurados, é possível importar atividades e entregar uma URL HTTPS após confirmação explícita.

## Desenvolvimento

Use Node `24.22.1` e as dependências exatas do `package-lock.json`:

```bash
npm ci
npm run dev
```

`npm run dev` inicia a interface e a API na porta 8888 com o plugin oficial Netlify para Vite. Ele emula as funções, os headers e os redirects do projeto. `npm run dev:web` fica reservado à interface na porta 5173 e ao uso opcional do CLI; use o primeiro comando para testar as rotas `/api/*`. Não é necessário acrescentar flags `--offline`.

```bash
npm run typecheck
npm test
# Instala o navegador dos testes; no CI, acrescente --with-deps.
npm exec -- playwright install chromium
npm run test:e2e
# Requer Docker: PostgreSQL isolado; não acessa o banco hospedado.
npm run test:db
# Integração real no Supabase local; os usuários de teste são descartáveis.
npm run db:start
npm run test:integration
npm run build
npm audit --omit=dev --audit-level=high
```

O repositório contém configuração para Supabase, Netlify e GitHub Actions. A existência desses arquivos não cria contas, banco de dados ou site publicado. Consulte [a configuração dos serviços](docs/CONFIGURACAO.md) e [o contrato de execução e agentes](docs/ORQUESTRACAO.md). O [contexto reconstruído](docs/CONTEXT.md) preserva os requisitos conhecidos e as decisões para próximas tarefas.

## Fluxo de trabalho

1. Cadastre um trabalho ou importe uma atividade do Canvas.
2. Desenvolva e publique o trabalho web no repositório/site correspondente.
3. Guarde a URL HTTPS publicada e revise a atividade de destino.
4. Confirme a entrega pela interface, quando a API estiver habilitada para isso.

A integração de entrega inicial atende atividades Canvas que aceitem **URL de site (`online_url`)**. Arquivos, questionários e tipos de entrega diferentes precisam de fluxo próprio. Nenhum envio acontece ao apenas importar atividades ou editar um trabalho.

## Reprodutibilidade

Node `24.22.1`, npm `11.9.0`, TypeScript `6.0.3` e o plugin Netlify `3.0.1` foram selecionados como conjunto compatível. TypeScript 7 remove APIs de compilação utilizadas pelo empacotamento do Netlify CLI; atualizar esse componente exige revalidar a integração. O projeto não usa Edge Functions, por isso sua emulação fica desativada e dispensa o download de Deno no startup.

As versões diretas são exatas e o lockfile fixa a árvore transitiva. Use `npm ci`, sem atualizar o lockfile durante a configuração. O Dependabot propõe atualizações em PRs; ele não faz merge nem deploy por conta própria. Os workflows usam ações fixadas por SHA.

Não coloque tokens em arquivos versionados, variáveis `VITE_*` ou conteúdo dos trabalhos. O token pessoal do Canvas é usado apenas pela API e protegido pelo usuário proprietário configurado.

Os resultados executados e os limites desta preparação estão em [VALIDACAO.md](docs/VALIDACAO.md).
