# Validação local — 05/11/2026

> Atualização posterior: sincronização automática e entregas de grupo validadas
> com 52 testes Java, nove testes frontend/E2E e novos testes SQL/RLS. Evidências
> e publicação em [SINCRONIZACAO_CANVAS.md](SINCRONIZACAO_CANVAS.md).
> As contagens abaixo preservam a etapa anterior.

Raiz: `/run/media/kali/Extreme SSD/04-dev/auto-faculdade/campusflow`.
Os resultados abaixo foram executados neste computador, separadamente do
histórico de [VALIDACAO.md](VALIDACAO.md).

| Comando/verificação | Resultado |
|---|---|
| `bash scripts/local.sh npm ci` | Exit 0; 983 pacotes instalados; lockfile preservado |
| `bash scripts/java-toolchain.sh` | Exit 0; javac 21.0.13, Maven 3.9.11 |
| `bash scripts/local.sh node --version` | 24.22.1 |
| `bash scripts/local.sh npm --version` | 11.9.0 |
| `bash scripts/local.sh npm run check` | Exit 0; tipos, Maven verify e build frontend |
| Relatórios Surefire XML | 45 testes: 3 HTTP, 33 controlador, 4 proxy, 5 transporte; zero falhas/erros/ignorados |
| `bash scripts/local.sh npm run test:e2e` | Exit 0; 6 testes passaram; execução final isolada em 9,1s com Chromium local, mesmo após configurar Supabase hospedado |
| `bash scripts/local.sh npm run test:db:native` | Exit 0; PostgreSQL 18, migração aplicada duas vezes; todos os cenários SQL/RLS passaram; ROLLBACK e cluster removido |
| `bash scripts/local.sh npm exec -- netlify build --offline` | Exit 0; build estático, sem deploy |
| `bash scripts/local.sh npm run dev` | Frontend 8888 e Java 8080 iniciados |
| GET `http://127.0.0.1:8888/api/health` após reinício final | HTTP 200 JSON; status ok, Canvas e Supabase configurados, entregas desabilitadas |
| GET `/api/canvas/courses` anônimo | HTTP 401 |
| Navegador oficial conectado ao localhost | Interface carregada; demonstração identificada antes da configuração; login Supabase após configurar |
| Arquivo privado externo temporário | Java isolado respondeu na porta 18082 definida por `CAMPUSFLOW_ENV_FILE`; fixture removida sem sobrescrever arquivos pessoais |
| CORS para a origem Netlify real | Preflight retorna exatamente `https://campusflow-murilobertelli.netlify.app` |
| `npm audit --omit=dev --json` pelo launcher | Exit 0; zero vulnerabilidades reportadas |
| `npm audit --json` pelo launcher | 18 findings de ferramentas dev: duas baixas, 16 moderadas; nenhum fix automático |

Os testes E2E cobriram: roteamento JSON/autenticação; criar/editar/recarregar/
filtrar/remover trabalho; URL insegura sem perder rascunho; bloqueio de entrega
no modo local; exportação JSON; responsividade móvel e preservação de dados
locais inválidos. Dados de navegador de teste são descartáveis e não representam
trabalhos ou entregas reais.

O runner final nunca reutiliza o servidor pessoal e inicia frontend/Java com
Supabase/Canvas externos vazios. Não foi usado o banco hospedado como fixture.
As duas execuções do mesmo conjunto E2E continuam contando como seis cenários,
sem duplicação artificial da contagem.

O SQL verifica proprietário padrão, atualização/timestamp, troca de proprietário
negada, deduplicação Canvas, status/título inválidos, isolamento de leitura/
atualização/exclusão, proprietário forjado, importações independentes, acesso
anônimo negado e exclusão pelo dono. `auth.uid()` é emulado no cluster isolado.
PostgreSQL 18 difere do PostgreSQL 17 fixado para o Supabase local com Docker.

## Verificações dos serviços reais

| Operação | Evidência |
|---|---|
| Supabase CampusFlow criado | `sbdpgdmjtksmshurpywm`, Free, Nano, sa-east-1, Healthy |
| Migração pelo SQL Editor no projeto novo | Success; fonte SQL original e checksum preservados |
| Catálogo `assignments` | RLS enabled=true, forced=true, 4 políticas, 0 grants anon, 4 grants CRUD authenticated |
| Auth settings via chave pública | HTTP 200, `disable_signup=true`, anonymous=false |
| SELECT anônimo de assignments | HTTP 401 |
| Conta proprietária | Conta/UUID conferidos no painel; senha criada pelo usuário; último login verificado no Auth após confirmação do usuário |
| Site URL e redirects Auth | Origem Netlify real + duas origens locais exatas, sem wildcard |
| Publicação manual Netlify | Site `42494a22-bd34-42a7-880d-d134a83b10ef`, deploy `6aed2c8442cc09fe917b356e` publicado |
| HTTPS frontend e SPA fallback | HTTP 200 em `/` e rota direta |
| API ausente no site estático | `/api/health` retorna HTTP 404 JSON, sem mascarar com a SPA |
| Cabeçalhos Netlify reais | nosniff, strict-origin-when-cross-origin, DENY e bloqueios camera/microphone/geolocation |
| Configuração pública Netlify | Somente três VITE_*; API_BASE_URL vazio, nenhuma credencial de backend |
| Origem Canvas | Link AVA da fonte oficial PUCPR confirma `https://pucpr.instructure.com` |
| GET Canvas `/api/v1/users/self/profile` | HTTP 200, identidade autenticada presente; sem imprimir dados pessoais |
| GET Canvas cursos ativos | HTTP 200, 11 cursos, sem próxima página; sem salvar dados acadêmicos como fixture |
| Frontend local → Java → Supabase Auth → Canvas | Sessão real conectada; 11 disciplinas e 19 atividades com prazos visíveis; nenhuma importação/entrega acionada pelo agente |
| Token privado | Arquivo Linux modo 0600; token ausente do `.env.local` público, bundle e ZIP Netlify |

O login real foi confirmado pelo usuário e pelo campo de último login no
Supabase Auth. A sessão proprietária foi observada no aplicativo local, onde
as leituras Canvas através do backend Java foram verificadas na interface.
A aba controlada do frontend publicado continuava exibindo o login; nenhuma
sessão/token foi extraída para forçar compartilhamento entre abas.
Escrita/CRUD hospedado não foi usada como teste de produção.

## Falhas locais diagnosticadas

- Extração inicial do JDK no SSD exFAT: falhou ao criar symlinks. Corrigido pelo
  cache Linux; artefatos incompletos dessa tentativa removidos.
- Primeiro teste SQL através do namespace: PostgreSQL recusou UID 0. O launcher
  agora remapeia o processo ao UID/GID original; o teste nativo final passou.
- Um aviso de interface do Supabase encobria o botão de adicionar redirects;
  após fechá-lo, os três retornos exatos foram salvos e conferidos.

## Evidências locais

Logs da sessão em `/tmp/campusflow-*.log` e auditorias em
`/tmp/campusflow-audit-{production,all}.json`; cópias persistentes ficam em
`~/.cache/campusflow-local/evidence`. Os XML Surefire estão em
`backend/target/surefire-reports/`.

Captura da interface: `~/.cache/campusflow-local/evidence/campusflow-local.png`.
Formulário Supabase preparado, antes da senha/criação:
`~/.cache/campusflow-local/evidence/supabase-create-prepared.png`.

## Limitações

- Docker não instalado: a suite automatizada `test:integration` com Supabase
  local, o teste SQL em container e o build da imagem não foram executados.
- Nenhum banco hospedado foi usado como fixture; a validação de catálogo e
  consultas anônimas foram somente leitura.
- A aplicação Java está local; falta escolher o host HTTPS e reconstruir/
  republicar o frontend com a origem real da API para usar Canvas no site.
- Sem commit/push, CI/CD reativado, POST Canvas ou envio acadêmico real.

Consulte [CONTINUAR_LOCAL.md](CONTINUAR_LOCAL.md) para os serviços consultados,
mudanças e próximos passos autorizados.
