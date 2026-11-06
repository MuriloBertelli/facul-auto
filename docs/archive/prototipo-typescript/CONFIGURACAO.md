# Configuração dos serviços

## O que funciona sem contas externas

A interface pode ser iniciada em modo local para cadastrar, editar e acompanhar trabalhos no navegador. Esse armazenamento não substitui backup e não é sincronizado entre dispositivos. A API pode responder ao health check sem acessar o Canvas ou o Supabase. `npm test` usa dependências simuladas. `npm run test:integration` verifica Auth, PostgREST e RLS reais no Supabase local; somente as respostas Canvas são simuladas. Nenhum desses testes entrega atividades reais.

A integração externa depende de um projeto Supabase, um usuário proprietário, um site Netlify, do endereço HTTPS correto do Canvas da instituição e de um token Canvas válido. Nenhum desses recursos é criado apenas por clonar o repositório.

## Variáveis

Copie `.env.example` para `.env` para desenvolvimento local e preencha somente no ambiente seguro. No Netlify, cadastre os valores nas variáveis do site. Nunca envie valores de tokens pelo chat nem adicione `.env` ao Git.

| Nome | Uso | Natureza |
|---|---|---|
| `VITE_SUPABASE_URL` | URL do projeto acessível pela interface | Pública; embutida no build |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publishable para a interface | Pública; embutida no build |
| `SUPABASE_URL` | Mesmo projeto, utilizado pela API | Configuração do servidor |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publishable da API para validar o usuário | Não usar `service_role` |
| `SUPABASE_OWNER_USER_ID` | UUID do usuário autorizado a usar o token pessoal Canvas | Identificador do proprietário |
| `CANVAS_BASE_URL` | Origem HTTPS da instituição, sem `/api/v1` no final | Configuração do servidor |
| `CANVAS_API_TOKEN` | Token pessoal do Canvas | Segredo; somente servidor |
| `CANVAS_SUBMISSIONS_ENABLED` | `true` permite a entrega após confirmação; padrão `false` | Controle de operação |

A chave publishable não dá acesso por si só às linhas de outros usuários: as políticas de RLS devem estar aplicadas. O token pessoal Canvas representa uma única conta da faculdade; por isso a API também verifica o `SUPABASE_OWNER_USER_ID`. Não use este modelo como serviço multiusuário compartilhando o mesmo token.

Valores `VITE_*` exigem novo build após alterações. Variáveis da API precisam estar disponíveis nas funções do site, não somente na etapa de build. Reinicie `npm run dev` após alterar `.env`.

## Startup e ferramentas fixadas

No diretório do projeto, execute `npm ci` e depois `npm run dev`, sem flags adicionais. O plugin oficial `@netlify/vite-plugin` `3.0.1` inicia a interface e a emulação de Netlify Functions, headers e redirects na porta 8888. A emulação de Edge Functions está desativada porque o projeto não contém essas funções. Isso evita o download de Deno exigido pelo startup do CLI e que falhou no proxy deste ambiente.

`npm run dev:web` permanece na porta 5173 para a interface e a integração opcional com Netlify CLI. O CLI continua fixado no lockfile para build/publicação. O caminho padrão de desenvolvimento é `npm run dev`.

As versões Node `24.22.1`, npm `11.9.0` e TypeScript `6.0.3` devem permanecer alinhadas ao lockfile e ao CI. TypeScript 7 remove APIs do compilador usadas pelo bundler do CLI e causou uma falha de integração; por isso ele não é adotado nesta base. Não corrija problemas de startup desativando verificação TLS ou baixando runtimes de fontes alternativas.

Para os testes de navegador, instale o Chromium gerenciado pela versão fixada do Playwright com `npm exec -- playwright install chromium`, depois execute `npm run test:e2e`. O CI usa `npm exec -- playwright install --with-deps chromium` para instalar também as dependências Linux do navegador. Esses comandos preparam o teste; seu sucesso não é presumido antes da execução completa.

## Supabase

1. Crie ou selecione um projeto Supabase.
2. Revise e aplique a migração SQL em `supabase/migrations/` no projeto escolhido. Ela cria a tabela de trabalhos e políticas por usuário. Não execute em um projeto de produção desconhecido.
3. No painel de autenticação, desative cadastro público e crie seu usuário de e-mail/senha. A interface usa esse usuário para entrar.
4. Copie o UUID desse usuário para `SUPABASE_OWNER_USER_ID`.
5. Configure URL e chave **publishable** do mesmo projeto no servidor e na interface. Nunca use a chave `service_role` no navegador.
6. Entre no aplicativo e teste criar, editar e excluir um trabalho seu. Uma sessão anônima não deve ler ou alterar a tabela.

A configuração em `supabase/config.toml` também permite usar o Supabase CLI `3.0.0` com Docker em uma máquina compatível. Execute `npm run db:start`: o wrapper define `SUPABASE_HOME` em uma pasta gravável do projeto, sem alterar `HOME`. Os serviços mínimos são PostgreSQL, Auth, PostgREST e Kong; os componentes opcionais estão excluídos no script. `npm run test:integration` cria usuários locais descartáveis, valida login/CRUD/RLS e os remove ao terminar. Esse teste recusa qualquer destino que não seja o Supabase local na porta 54321.

Neste ambiente, o `wget` do health check de Auth ignora `NO_PROXY` e tentava enviar uma requisição de loopback ao proxy externo. O wrapper cria uma configuração Docker exclusiva na pasta ignorada `.cache/docker-supabase`, sem copiar credenciais: ela mantém o proxy HTTPS e deixa de injetar proxy HTTP somente nesses contêineres locais. Os proxies do host e do daemon permanecem intactos. O health check continua obrigatório. Não se presume que Docker esteja disponível em todo ambiente de nuvem. Use `npm run db:stop` para parar a pilha sem apagar os volumes; não use `db reset` para iniciar o desenvolvimento.

## Canvas

1. Informe o domínio HTTPS real do Canvas da faculdade em `CANVAS_BASE_URL`.
2. Cadastre seu token no segredo `CANVAS_API_TOKEN`, exclusivamente no servidor. O token não deve aparecer no bundle da interface, GitHub Actions, logs ou links de entrega.
3. Com o usuário proprietário autenticado, liste disciplinas e importe uma atividade. Os endpoints consultam somente o domínio configurado e limitam paginação.
4. Mantenha `CANVAS_SUBMISSIONS_ENABLED=false` até revisar o destino e testar a integração de leitura.
5. Quando quiser habilitar entregas, defina `true`. A interface ainda exige URL HTTPS, atividade compatível e confirmação explícita para cada envio.

O aplicativo não calcula respostas acadêmicas nem entrega trabalhos ao salvar um rascunho. Uma resposta de sucesso da API de envio confirma o retorno do Canvas para aquela operação; para verificar a versão efetiva e eventuais políticas da disciplina, consulte a atividade na própria faculdade.

## Netlify

1. Crie ou selecione um site Netlify para este projeto. `netlify.toml` define o build, `dist`, as funções e o desenvolvimento local.
2. Configure as variáveis da tabela. A configuração do domínio público e das URLs permitidas de autenticação deve corresponder ao site efetivamente criado.
3. Faça um deploy de revisão e valide login, CRUD e leitura Canvas antes de habilitar envios.
4. Confirme que `/api/health` retorna JSON e que a página abre corretamente. Um servidor em execução ou um build concluído não comprovam as integrações hospedadas.

Se o GitHub Actions for responsável pelo deploy, desative o auto-publish independente da integração Git do Netlify para evitar duas publicações concorrentes. Pré-visualizações públicas exigem análise própria de acesso e dados.

## GitHub Actions e entrega

O workflow `Validar e entregar` roda tipos, testes de API, testes de navegador em Chromium, build, auditoria de dependências de produção e testes SQL em PostgreSQL isolado em PRs e pushes em `main`. O teste SQL usa Docker e uma imagem oficial fixada por digest; não aplica migrações no projeto Supabase hospedado. Os comandos preservam seus códigos de saída. Uma vulnerabilidade alta ou crítica em dependências de produção bloqueia o workflow.

A publicação fica desabilitada até você configurar:

- Environment GitHub `production`, com revisores obrigatórios e restrição à branch `main`, conforme os recursos do seu plano GitHub.
- Secrets `NETLIFY_AUTH_TOKEN` e `NETLIFY_SITE_ID` no environment `production`.
- Variables públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` para o build.
- Variable de repositório `NETLIFY_DEPLOY_ENABLED=true` somente depois de configurar as proteções.

O YAML referencia `production`, mas **não cria nem impõe sozinho os revisores**: sem configurar esse environment no GitHub, a aprovação não está garantida. O gate `NETLIFY_DEPLOY_ENABLED` é desativado quando ausente.

Com essa configuração, um push em `main` só publica após os dois jobs de validação (aplicação com navegador e banco isolado) e os gates do environment. Também existe execução manual com a opção `deploy`, restrita a `main` e ao mesmo gate. PRs não recebem os segredos de publicação nem disparam deploy.

O job de publicação faz `npm ci` e `netlify deploy --build --prod` com o CLI fixado no lockfile. O rebuild é intencional para empacotar frontend e funções em conjunto. Migrações de banco não são aplicadas automaticamente pelo workflow; precisam de revisão e aplicação no projeto Supabase correto.

## Credenciais e rede no ambiente de nuvem

Use bindings existentes e teste a operação necessária antes de solicitar novas credenciais. Autenticação Git HTTPS fornecida pela plataforma não implica acesso à API do GitHub, ao Netlify ou ao Supabase.

Destinos esperados: `registry.npmjs.org`, `github.com`, `api.netlify.com`, o domínio específico do projeto Supabase e o domínio específico Canvas da instituição. Descargas adicionais do CLI ou dos serviços podem exigir domínios oficiais identificados pela operação. Preserve os destinos já existentes ao atualizar a allowlist; não substitua regras desconhecidas por `*`.

O arquivo de token enviado nesta conversa não deve ser versionado. Um upload de token não configura, por si só, um segredo persistente para futuras tarefas. Cadastre os valores nos ajustes seguros dos serviços e do ambiente quando necessário.

## Estado de validação

Este documento descreve o procedimento reproduzível e os pré-requisitos. Resultados de execução devem ser registrados com comandos e evidências no relatório da tarefa. Build local, API simulada, acesso Canvas real, implantação Netlify e restauração em uma tarefa nova são verificações distintas. Não se considera uma integração externa validada sem executar sua operação específica.

O workflow foi validado localmente contra o schema GitHub Actions publicado pelo SchemaStore e teve a estrutura de `workflow_dispatch.inputs`, jobs e dependências conferida. A configuração relativa `cache=.cache/npm` resolve para uma pasta do próprio checkout, consultada pelo `setup-node`. Isso não substitui uma execução real no GitHub: a execução hospedada do CI e do CD permanece pendente até o código estar no repositório e as configurações externas estarem disponíveis.

Consulte [VALIDACAO.md](VALIDACAO.md) para os resultados efetivamente executados nesta preparação.
