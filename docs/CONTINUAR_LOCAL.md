# Continuação local — CampusFlow

> Estado mais recente: atividades sincronizadas automaticamente em Meus
> trabalhos e entregas de grupo identificadas; 82 atividades reais importadas.
> Nova migração aplicada, frontend republicado e verificações atualizadas em
> [SINCRONIZACAO_CANVAS.md](SINCRONIZACAO_CANVAS.md).

Estado verificado em **05/11/2026**, no computador do usuário. Este registro
complementa os documentos históricos da nuvem; não presume recuperação das
credenciais ou dos arquivos daquela máquina.

## A — Resultado

O projeto Java/React está instalado e executando a partir do SSD em
`/run/media/kali/Extreme SSD/04-dev/auto-faculdade/campusflow`.
Tipos/build, 45 testes Java, seis testes de navegador, SQL/RLS isolado e build
Netlify offline passaram. Supabase e Canvas estão configurados no backend
local; o frontend foi publicado manualmente no Netlify com Supabase conectado.
A conta proprietária foi criada com senha definida pelo usuário, que confirmou
login; o registro de último login no Supabase foi verificado. O host Java de
produção ainda não foi selecionado. Nenhuma entrega real ocorreu.

## B — Estado inicial e Git

- A extração já continha `package.json`, `frontend/package.json` e
  `backend/pom.xml` com Spring Boot 3.5.16. Não foi necessário trocar o backend.
- Não havia `.git`. O conector oficial GitHub confirmou o repositório privado
  `MuriloBertelli/facul-auto`, tamanho zero e lista de branches vazia.
  O acesso Git HTTPS pelo terminal não tinha autenticação.
- Foi criado apenas o Git **nesta pasta existente**, branch local `main`, com
  `origin=https://github.com/MuriloBertelli/facul-auto.git`. Sem HEAD, commits,
  push, clone ou worktree adicional. Os fontes aparecem como não rastreados.
- Antes das alterações foi salvo um manifesto SHA-256 de 71 arquivos em
  `~/.cache/campusflow-local/source-baseline.json`. O lockfile foi preservado.
- `tools/browser-mcp/`, `.codex/config.toml`, os scripts MCP e estes documentos
  de continuação não vieram na extração. Nenhum ZIP fonte foi encontrado na
  pasta do projeto. O backend já era Java, portanto a comparação com o ZIP
  antigo não foi necessária.
- O arquivo Canvas `../token-2026-10-05` foi preservado. Seu valor não foi
  impresso, copiado para o frontend nem enviado a qualquer domínio.

## C — Ambiente e arquitetura

O Node do sistema era 24.21.0, sem npm no PATH; o Java do sistema era 25.
O launcher usa **Node 24.22.1 e npm 11.9.0**, sem alterar instalações globais.
O toolchain usa **Temurin 21.0.13+9 e Maven 3.9.11**, com verificação dos
checksums oficiais. PostgreSQL nativo 18 e Chromium estavam disponíveis.
Docker não estava disponível.

O SSD é **exFAT**. A primeira extração do JDK falhou porque esse sistema de
arquivos não armazena links simbólicos. Os artefatos incompletos gerados nessa
tentativa foram removidos depois da instalação correta no cache Linux.

`scripts/local.sh` mantém ferramentas/dependências em
`~/.cache/campusflow-local`. Em exFAT, monta somente `node_modules` no
namespace privado do comando, com `unshare`, sem sudo ou mounts persistentes.
Uma segunda camada de namespace devolve o UID/GID original ao processo da
aplicação, inclusive para o PostgreSQL nativo. Não há cópia de fontes.
O suporte a namespaces de usuário foi testado neste computador.

## D — Responsabilidade

Esta etapa local foi executada por um único agente. Não foi declarada revisão
independente nem reaproveitada a contagem de agentes/testes da nuvem como
evidência nova.

## E — Alterações e finalidade

- `scripts/local.sh`: instalação local fixada de Node/npm e dependências fora
  do exFAT, preservando o código no SSD.
- `scripts/java-toolchain.sh`: cache padrão fora do SSD para instalações locais.
- `scripts/environment.mjs`: suporte a `CAMPUSFLOW_ENV_FILE`, antes dos arquivos
  `.env.local`/`.env`, para carregar segredos de um arquivo privado externo.
- `frontend/playwright.config.ts`: E2E sempre inicia um servidor próprio com
  variáveis externas vazias, sem reutilizar o servidor pessoal configurado.
- `scripts/package-netlify.py` e `package:netlify`: pacote estático manual,
  gerando `_redirects` e `_headers` a partir do `netlify.toml`, sem duplicar
  essas regras nos fontes nem incluir segredos/backend.
- `supabase/tests/run-native-isolated.sh` e `test:db:native`: alternativa de
  verificação SQL/RLS quando PostgreSQL está instalado e Docker está ausente.
  Cluster descartável, socket privado, TCP desabilitado e limpeza automática.
- README e documentação: procedimentos locais atuais separados do histórico.

## F — Dados e riscos

O exFAT não aplica permissões Unix 0600 por arquivo. Não gravar novos segredos
do backend nesse volume. `VITE_*` públicos podem ficar em `.env.local` ignorado;
segredos devem ficar em um arquivo no filesystem Linux, com modo 0600, indicado
por `CAMPUSFLOW_ENV_FILE`. O launcher também reconhece automaticamente
`~/.cache/campusflow-local/projects/<hash-do-caminho>/private.env`.

`npm audit --omit=dev` reportou zero vulnerabilidades. A auditoria completa
reportou 18 (duas baixas e 16 moderadas) nas ferramentas transitivas de
desenvolvimento associadas ao Netlify CLI. Nenhuma versão foi atualizada
automaticamente para alterar o lockfile ou ocultar o resultado.

## G — Validação

Evidências, comandos e limitações em [VALIDACAO_LOCAL.md](VALIDACAO_LOCAL.md).
A integração completa Auth/PostgREST local e a imagem Docker não foram
executadas, pois Docker não está instalado. O SQL nativo usa `auth.uid()`
emulado e não substitui essa integração.

## H — Serviços consultados

As sessões oficiais do navegador funcionaram ao abrir novas abas. Não foi
necessário extrair cookies/perfis nem instalar um MCP para acessar os painéis.

**Supabase:** organizações pessoais/equipe consultadas. A organização pessoal
`kconeyzmcdxheylfviwc` contém `timesheet-controle-horas`
(`lomflfybdjqidlhwptdq`), que não aparece no filtro de projetos ativos.
`Eletro-Vegetal Org` contém um projeto ativo `eletro-vegetal Project`
(`fbjqxfzjyrsqvdjhxwtk`). Nenhum deles foi alterado.
O plano Free permite dois projetos ativos segundo a
[documentação oficial](https://supabase.com/docs/guides/platform/billing-faq).
O usuário concluiu o formulário gratuito preparado para **CampusFlow**,
organização pessoal, São Paulo (`sa-east-1`), Data API ativa, exposição
automática de tabelas desabilitada e RLS automático habilitado.
Projeto confirmado saudável: **`sbdpgdmjtksmshurpywm`**, URL pública
`https://sbdpgdmjtksmshurpywm.supabase.co`.

A migração revisada foi aplicada pelo SQL Editor ao banco novo e retornou
sucesso. A consulta de catálogo confirmou `assignments`, RLS ativo e forçado,
quatro políticas, zero grants `anon` e quatro grants CRUD `authenticated`.
Essa aplicação manual não registra automaticamente a versão no histórico do
CLI de migrações; antes de um futuro `supabase db push`, reconciliar o histórico
com o schema existente. Não foi usado banco pessoal antigo como fixture.

Signup público foi desabilitado e a API Auth confirmou `disable_signup=true`,
anonymous desabilitado. O usuário criou `mrlbertelli@gmail.com` no formulário
administrativo, definindo pessoalmente a senha. O UUID foi verificado e salvo
em `SUPABASE_OWNER_USER_ID` no arquivo privado do backend. O último login foi
verificado no painel Auth; a sessão proprietária foi observada no aplicativo
local. A aba controlada do site publicado continuava exibindo o login.
Site URL e allowlist de retornos foram configurados para a origem Netlify real
e as duas origens locais exatas na porta 8888.

**Netlify:** sessão de `mrlbertelli@gmail.com`, equipe Liro (`liro-ftl8xk`).
A lista mostrou somente `docmurilobertelli`, ligado a outro repositório;
foi preservado. O plano existente é Free, sem meio de pagamento cadastrado;
nenhum plano/add-on pago foi contratado.

Foi criado **um** novo site por upload manual do ZIP estático validado e seu
nome automático foi alterado para **`campusflow-murilobertelli`**:

- URL: `https://campusflow-murilobertelli.netlify.app`.
- Site ID: `42494a22-bd34-42a7-880d-d134a83b10ef`.
- Deploy publicado: `6aed2c8442cc09fe917b356e`.
- Configuração pública `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`
  salva no Netlify; `VITE_API_BASE_URL` permanece vazio até existir API HTTPS.
- Binding local em `.netlify/state.json`, ignorado pelo Git.
- HTTPS 200, fallback SPA 200, `/api/health` 404 JSON e os quatro cabeçalhos
  estáticos foram verificados no site real. Nenhuma API foi simulada como viva.

Nenhum repositório foi ligado ao site, workflow ativado ou push executado.

**Backend:** nenhum host foi selecionado/provisionado e não há hostname de
produção. Render Free é uma opção para testes com Docker/JVM, sem tratá-lo
como produção: há suspensão por inatividade e limites de uso, conforme
[Free](https://render.com/docs/free) e [Docker](https://render.com/docs/docker).
Nenhuma conta/plano foi contratado nem credencial foi enviada ao Render.

**Canvas:** a origem `https://pucpr.instructure.com` foi confirmada pelo link
AVA da [página oficial da PUCPR](https://estudante.pucpr.br/pos/), sem adivinhar
o domínio. Após o pedido explícito de salvar os dados anexados, o único token
do arquivo autorizado foi salvo em `CANVAS_API_TOKEN`, junto da origem em
`CANVAS_BASE_URL`, no arquivo privado Linux de modo 0600. O arquivo original
foi preservado. Foi verificado que esse token não aparece no `.env.local`
público, bundle ou ZIP de publicação.

Consultas HTTPS de leitura, sem seguir redirecionamentos, retornaram HTTP 200
para o perfil autenticado e para a lista de disciplinas ativas: **11 cursos**,
sem próxima página. Não foram salvos nomes, atividades ou dados acadêmicos
como fixtures. Nenhum POST de entrega foi executado.

Com a sessão proprietária real no aplicativo local, a integração completa
frontend → API Java → validação Supabase → Canvas foi verificada na interface:
**11 disciplinas** carregadas e **19 atividades** exibidas na disciplina
selecionada pelo usuário, com prazos e indicação de entregas existentes.
O agente não acionou Adicionar/importação, edição ou entrega de atividade.

## I — Decisão indispensável pendente

Escolher o host Java ou manter a API local por enquanto. Produção exige
origem HTTPS real da API, CORS exato e novo build com `VITE_API_BASE_URL`.
A pergunta sobre o destino foi enviada ao usuário; ainda não houve escolha.
Nenhum hostname de produção ou custo foi presumido.

Leitura/análise por IA e relatórios Poliweek continuam fora da implementação
verificada. Faltam provedor/modelo e atividades/artefatos reais. Cada eventual
entrega Canvas ainda exige confirmação específica de atividade, destino e URL.

## J — Gates

| Gate | Estado |
|---|---|
| Pasta, versões, Git e preservação | GO para a continuação local |
| Instalação e startup no SSD | GO usando `scripts/local.sh` |
| Java/frontend, navegador e SQL/RLS isolado | GO no escopo executado |
| Supabase hospedado | Criado/configurado; migração, RLS, restrição de signup e proprietário verificados |
| Netlify frontend | Publicado manualmente, com Supabase; tela de login e respostas HTTP verificadas |
| Backend hospedado | Não selecionado |
| Canvas real | Origem/token e leitura pela API Java com sessão real verificados; nenhum envio |
| CI/CD, push e relatórios Poliweek | Não executados |

## K — Como retomar sem reinstalar tudo

Execute na raiz local real:

```bash
bash scripts/local.sh npm run dev
# Verificação Java + frontend
bash scripts/local.sh npm run check
# Navegador
bash scripts/local.sh npm run test:e2e
# SQL/RLS sem Docker, com PostgreSQL nativo
bash scripts/local.sh npm run test:db:native
# Build estático Netlify, sem publicação
bash scripts/local.sh npm exec -- netlify build --offline
# Preparar novo ZIP manual com regras/headers do TOML
bash scripts/local.sh npm run package:netlify
```

O frontend usa 8888; Java, 8080; `/api` passa pelo proxy Vite. A aplicação foi
reiniciada com a configuração privada. O health deve indicar `status=ok`,
`canvasConfigured=true`, `supabaseConfigured=true`, `submissionsEnabled=false`.
O processo iniciado nesta sessão tem PID registrado em
`~/.cache/campusflow-local/run/dev.pid` e log em `run/dev.log` no mesmo cache.
Não iniciar outro `dev` nas mesmas portas sem encerrar o anterior.

Para E2E, encerrar primeiro o servidor de desenvolvimento: o runner agora
recusa reutilizá-lo e usa somente configuração externa vazia/dados fictícios.
