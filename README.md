# CampusFlow

As atividades do Canvas agora entram automaticamente em **Meus trabalhos**,
agrupadas por disciplina e separadas em pendentes/concluídas e individuais/em
grupo. Veja [sincronização e validação](docs/SINCRONIZACAO_CANVAS.md).

O layout para celular e a sessão persistente foram validados em 320–430 px.
Veja o [estado das publicações](docs/MOBILE_E_PUBLICACAO.md) e o
[procedimento de acesso e entregas validadas](docs/ACESSO_E_ENTREGAS.md).
O pedido posterior de GitHub → Netlify automático e Sites substitui a exclusão
histórica de CI/CD descrita abaixo. Os três envios Poliweek foram validados
pelo usuário e confirmados pelo Canvas; a publicação pode prosseguir.

## Execução neste computador

O código está em `/run/media/kali/Extreme SSD/04-dev/auto-faculdade/campusflow`.
O SSD usa exFAT; para manter o código no lugar e instalar dependências com links
simbólicos, use o launcher local (Linux x86_64, sem sudo):

```bash
bash scripts/local.sh npm ci
bash scripts/java-toolchain.sh
bash scripts/local.sh npm run check
bash scripts/local.sh npm run dev
```

Abra `http://127.0.0.1:8888`. A API usa `http://127.0.0.1:8080`.
O frontend também foi publicado manualmente em
[campusflow-murilobertelli.netlify.app](https://campusflow-murilobertelli.netlify.app),
conectado ao Supabase. A API Java permanece local; o host de produção ainda
precisa ser escolhido. Entregas Canvas continuam desabilitadas.
O launcher fixa Node/npm e usa um cache Linux em `~/.cache/campusflow-local`,
com `node_modules` montado somente no namespace do comando. Não cria outro
checkout nem altera ferramentas globais. O restante deste README inclui o
histórico da nuvem; o estado local e as pendências atuais estão em
[CONTINUAR_LOCAL.md](docs/CONTINUAR_LOCAL.md) e [VALIDACAO_LOCAL.md](docs/VALIDACAO_LOCAL.md).

O template recebido foi preservado e preenchido em [docs/templates/](docs/templates/TEMPLATE_MESTRE_CAMPUSFLOW.md). Os resultados desta revisão estão em [VALIDACAO.md](docs/VALIDACAO.md), com consolidação no [relatório final](docs/RELATORIO_FINAL.md).

Organizador pessoal de atividades e trabalhos web para o Canvas da PUCPR. O frontend usa TypeScript/JavaScript com React; a API usa **Java 21 e Spring Boot**, em pastas separadas. Supabase concentra autenticação e dados. A conta proprietária e cada entrega ficam sob controle do usuário.

```text
frontend/   interface, integração Supabase e cliente da API
backend/    API Java 21 / Spring Boot e testes
supabase/   migrações e testes de isolamento dos dados
scripts/    ferramentas e inicialização reproduzíveis
docs/       requisitos preservados, template preenchido e evidências
```

O [template original](docs/templates/TEMPLATE_MESTRE_ORIGINAL.md) foi preservado sem alterações. O [template preenchido CampusFlow](docs/templates/TEMPLATE_MESTRE_CAMPUSFLOW.md) registra contexto, permissões, agentes, suposições e gates antes desta revisão. Consulte também [o contexto](docs/CONTEXT.md), [a arquitetura](docs/ARQUITETURA.md), [a configuração](docs/CONFIGURACAO.md) e [a validação atual](docs/VALIDACAO.md).

## Desenvolvimento

Execute os comandos na raiz do checkout. Node `24.22.1`, npm `11.9.0`, Temurin Java `21.0.13+9` e Maven `3.9.11` são as versões selecionadas. Os scripts instalam as ferramentas Java em cache gravável, preservando verificação de integridade e sem substituir o Java do sistema.

```bash
npm ci
bash scripts/java-toolchain.sh
npm run dev
```

O startup conjunto inicia frontend e API. A interface fica na porta 8888 e o backend Java na porta 8080. Em desenvolvimento, as chamadas relativas `/api/*` passam pelo proxy local. Serviços externos não configurados aparecem como pendências; dados de exemplo são identificados como modo local.

Para validar separadamente:

```bash
npm run typecheck
npm test
npm run build:frontend
npm run build:backend
# Requer Chromium gerenciado pela versão Playwright do lockfile.
npm exec -- playwright install chromium
npm run test:e2e
# Requer Docker; PostgreSQL isolado, sem aplicar migrações no banco hospedado.
npm run test:db
```

Os comandos acima são o procedimento; os resultados realmente executados estão em `docs/VALIDACAO.md`. Contagens do protótipo TypeScript anterior não comprovam funcionamento Java.

## Hospedagem e entrega

**Netlify hospeda o frontend estático.** O backend Spring Boot precisa de um host/container Java separado, ainda não selecionado. Configure `VITE_API_BASE_URL` com a origem HTTPS real da API e permita a origem real do frontend em `APP_ALLOWED_ORIGINS` no servidor. Sem essa configuração, `/api/*` no Netlify responde 404, sem mascarar a falta da API com a página da interface.

O template mais recente coloca **CI/CD e deploy direto fora do escopo**. O workflow anterior foi preservado em `docs/archive/ci-before-java.yml` e não é executado pelo GitHub. A validação desta revisão é manual; nenhum deploy é iniciado por esses arquivos.

O diretório solicitado no computador é `/run/media/kali/Extreme SSD/04-dev/auto-faculdade`. Ele não está montado nesta nuvem. Os arquivos preparados permanecem em `/workspace/facul-auto`; veja as [instruções de transferência](docs/CONFIGURACAO.md#transferir-para-o-ssd) sem presumir que a cópia já aconteceu.

Tokens Canvas e chaves administrativas ficam somente no servidor e nos mecanismos seguros dos serviços. Nunca entram no frontend, nos templates ou no Git. As versões das bibliotecas ficam registradas nas dependências/lockfile e no POM; atualizações precisam de revisão e nova validação.
