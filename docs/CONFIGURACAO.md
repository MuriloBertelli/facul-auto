# Configuração CampusFlow — Java 21 e frontend separado

> Continuação local: o SSD está acessível nesta sessão. Em exFAT, use
> `bash scripts/local.sh npm ...` conforme [CONTINUAR_LOCAL.md](CONTINUAR_LOCAL.md).
> O padrão local do toolchain Java agora é `~/.cache/campusflow-local/toolchains`.
> As referências a `/workspace` abaixo são históricas.

O checkout atual está em `/workspace/facul-auto`. A pasta no SSD do usuário não está montada nesta máquina. As instruções abaixo são para reproduzir o ambiente; resultados efetivamente executados ficam em `VALIDACAO.md`.

## Instalação e startup

Na raiz do checkout:

```bash
npm ci
bash scripts/java-toolchain.sh
npm run dev
```

O lockfile raiz cobre o workspace `frontend`; não crie um lockfile independente para a interface. O toolchain instala Temurin `21.0.13+9` e Maven `3.9.11` em cache gravável com verificação oficial de integridade. O wrapper Maven usa verificações estritas de checksum. Na nuvem, o cache padrão fica em `/workspace/.tools`; fora dela, em `.cache/toolchains` do projeto. `CAMPUSFLOW_TOOLS_DIR` permite selecionar outra pasta gravável, inclusive em caminhos com espaços. Não altera `HOME`, não substitui ferramentas do sistema e não desabilita TLS.

O startup conjunto inicia frontend na porta 8888 e backend Java na porta 8080. O proxy local atende as rotas `/api/*`. Para executar uma parte isolada, use `npm run dev:frontend` ou `npm run dev:backend`, mantendo ambos disponíveis para testar a integração completa.

```bash
npm run typecheck
npm test
npm run build:frontend
npm run build:backend
npm exec -- playwright install chromium
npm run test:e2e
npm run test:db
```

`npm test` executa o backend Java/Maven. O teste SQL usa Docker/PostgreSQL isolado; não aplica migrações em um projeto hospedado. A instalação Chromium prepara o navegador do Playwright fixado no lockfile, mas não conta como teste executado. Não reutilize contagens do protótipo TypeScript para declarar a implementação Java pronta.

## Variáveis

O arquivo `.env.example` não contém valores de credenciais. Para o ambiente local, copie-o para `.env` e preencha somente pelos mecanismos seguros disponíveis. Os scripts de startup devem propagar essas variáveis aos processos; uma execução Java direta precisa recebê-las no ambiente do processo, pois Spring Boot não carrega um arquivo `.env` arbitrário por si só.

| Nome | Destino | Finalidade |
|---|---|---|
| `VITE_SUPABASE_URL` | Build frontend | URL pública do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Build frontend | Chave publishable; nunca `service_role` |
| `VITE_API_BASE_URL` | Build frontend | Origem HTTPS real da API Java; vazia no fluxo local com proxy |
| `SUPABASE_URL` | Backend | Mesmo projeto usado pela interface |
| `SUPABASE_PUBLISHABLE_KEY` | Backend | Validação da sessão Supabase |
| `SUPABASE_OWNER_USER_ID` | Backend | UUID da conta proprietária autorizada a usar o token Canvas |
| `CANVAS_BASE_URL` | Backend | Origem HTTPS da instituição, sem `/api/v1` final |
| `CANVAS_API_TOKEN` | Backend, segredo | Token pessoal da faculdade |
| `CANVAS_SUBMISSIONS_ENABLED` | Backend | Padrão `false`; habilitar não elimina confirmação por entrega |
| `PORT` | Backend | Porta HTTP do processo Java; padrão 8080 |
| `APP_ALLOWED_ORIGINS` | Backend | Lista de origens exatas separadas por vírgula; desenvolvimento: loopback na porta 8888 |

Variáveis `VITE_*` são públicas e exigem novo build após alteração. Segredos não devem aparecer em variáveis públicas, Git, relatórios, templates ou anexos de entrega. Uma alteração no processo Java requer reinício para assumir a nova configuração.

## Supabase e login único

O usuário solicitou que a configuração seja executada pelo agente e que somente ele defina sua senha. O fluxo previsto é selecionar ou criar o projeto na conta administrativa autenticada, aplicar a migração revisada no destino correto, desabilitar signup público e preparar a conta proprietária `mrlbertelli@gmail.com` pelo fluxo seguro de definição de senha. Nenhuma senha é gerada ou pedida em chat.

Para executar essa etapa remota, é necessário acesso administrativo ao Supabase, organização/projeto de destino e escopo de criação. Um token Canvas só autoriza operações Canvas; ele não administra Supabase. Ausência de autenticação administrativa é um pré-requisito concreto, não uma tarefa de implementação a transferir ao usuário. O agente deve concluir a preparação independente e retomar a criação quando a sessão segura estiver disponível.

Depois da criação da conta, seu UUID deve corresponder a `SUPABASE_OWNER_USER_ID`. A chave publishable identifica o projeto; as políticas de RLS e a verificação do usuário continuam obrigatórias. Não publicar signup aberto nem usar `service_role` no frontend. O termo “certificado no banco” do template ainda precisa de definição técnica; não foi transformado em uma PKI presumida.

O Supabase local usa um subconjunto de serviços necessários à aplicação. O wrapper `scripts/supabase.mjs` define um `SUPABASE_HOME` gravável e desativa telemetria, preservando as verificações de saúde. `npm run db:start`, `npm run db:status` e `npm run db:stop` gerenciam essa instância local. Banco local saudável não comprova Supabase hospedado configurado.

## Canvas e teste Poliweek

O endereço Canvas da faculdade, a validade do token no destino correto e as atividades/artefatos do teste Poliweek devem ser verificados. Usar apenas a origem configurada; não seguir paginação para outro host levando o token.

A integração inicial de entrega de trabalhos web utiliza URL HTTPS em atividades `online_url`. Importar ou editar atividades não deve enviar nada à faculdade. Cada envio precisa mostrar destino, URL final e confirmação explícita, com `CANVAS_SUBMISSIONS_ENABLED` habilitado no servidor. Em resultado de rede desconhecido após POST, conferir o recibo no Canvas antes de tentar novamente; não repetir automaticamente.

O objetivo de leitura/análise com IA consta no template, mas provedor/modelo e escopo de dados ainda não foram definidos. Não afirmar análise por IA, resolução de atividades ou entrega de relatórios reais a partir de testes simulados ou exemplos da interface.

## Netlify e host Java

`netlify.toml` usa a raiz do repositório como base, `npm run build:frontend` e publicação de `frontend/dist`. O npm instala as dependências pelo lockfile raiz e pelo workspace `frontend`. As funções TypeScript do protótipo anterior não são o backend deste desenho.

Spring Boot exige hospedagem JVM/container separada. O destino ainda não foi selecionado e nenhum hostname foi inventado. Depois de preparar esse host, configurar a origem real em `VITE_API_BASE_URL` e a origem real do frontend Netlify em `APP_ALLOWED_ORIGINS` da API. Manter HTTPS em produção.

O frontend Netlify retorna 404 para `/api/*` quando a origem da API não estiver configurada. O fallback SPA vem depois e não mascara a API ausente. O JSON de erro genérico não contém segredos ou um destino presumido.

A criação do site requer sessão ou credencial administrativa Netlify e conta/site de destino. Isso não é fornecido pelo token Canvas. A criação de Supabase/Netlify foi solicitada pelo usuário, mas não foi executada apenas por existir a configuração local.

## CI/CD e validação manual

O template mais recente exclui CI/CD e deploy direto. Por isso `.github/workflows/ci.yml` foi movido para `docs/archive/ci-before-java.yml`, e o Dependabot anterior foi preservado em `docs/archive/dependabot-before-java.yml`. Esses arquivos arquivados não executam jobs nem publicam o projeto.

A validação atual usa os comandos locais acima. A existência de um workflow histórico ou de uma validação YAML anterior não demonstra CI Java hospedado nem autoriza reativar automação. Um pedido futuro pode definir nova política de publicação após a seleção do host Java e revisão dos destinos.

## Transferir para o SSD

Destino solicitado: `/run/media/kali/Extreme SSD/04-dev/auto-faculdade`.

Esse caminho pertence ao computador do usuário e não está montado nesta nuvem. Não há evidência de arquivos copiados para lá. Prepare um arquivo de transferência do projeto nesta máquina, sem `.env`, token anexado, caches, dependências, resultados gerados ou dados locais. Copie esse arquivo para o computador pelo mecanismo de download/transferência disponível e então:

1. Confirme que o SSD está montado e que o diretório de destino não contém trabalho a sobrescrever.
2. Extraia o projeto no destino preservando arquivos locais existentes; se houver colisões, compare antes de substituir.
3. Execute `npm ci` e `bash scripts/java-toolchain.sh` na cópia local.
4. Configure os bindings/segredos pelo mecanismo seguro dessa máquina e execute `npm run dev`.
5. Repita os checks pertinentes. O sucesso na nuvem não comprova automaticamente o resultado no SSD.

O uso de Git para transportar os arquivos depende de commit/push específico; essa publicação do código não foi realizada nesta revisão. Não reescrever remotes nem forçar o estado remoto para contornar ausência de acesso ao SSD.

## Pré-requisitos externos e rede

Verifique bindings e autenticação existentes antes de solicitar algo novo. Destinos esperados incluem os repositórios oficiais de Java/Maven, `repo.maven.apache.org`, `registry.npmjs.org`, o domínio real Canvas, o projeto Supabase real e os serviços administrativos Netlify/Supabase. Domínios concretos devem vir da operação e da configuração da conta, nunca de um hostname inventado.

Preserve allowlists existentes. Não desabilite TLS, assinatura ou checksums para corrigir uma instalação. Não copie valores do anexo de token para scripts ou documentação. A publicação do ambiente de desenvolvimento, a publicação do frontend e uma entrega Canvas são ações distintas e precisam de evidências próprias.
