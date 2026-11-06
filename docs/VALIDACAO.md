# Evidências da revisão Java — CampusFlow

> Histórico da execução na nuvem. A validação realizada no computador em
> 05/11/2026 está em [VALIDACAO_LOCAL.md](VALIDACAO_LOCAL.md).

A arquitetura atual usa backend Java 21/Spring Boot e frontend TypeScript/JavaScript separado. Resultados do protótipo anterior foram preservados em [archive/prototipo-typescript/VALIDACAO.md](archive/prototipo-typescript/VALIDACAO.md). Eles não validam a nova API Java.

## Evidências já disponíveis desta revisão documental

| Verificação | Resultado |
|---|---|
| Template recebido | Original preservado byte a byte em `templates/TEMPLATE_MESTRE_ORIGINAL.md` |
| Template preenchido | Contexto, suposições, permissões, agentes e gates registrados antes das demais alterações documentais desta revisão |
| CI/CD anterior | Workflow e Dependabot movidos para `docs/archive/`; automação desativada nesta configuração |
| Arquitetura Netlify | TOML parseado; build/publicação apenas frontend; regra `/api/*` 404 antes da SPA e ausência de configuração Functions conferidas; comportamento hospedado ainda não executado |
| SSD final | Caminho informado não montado na nuvem; nenhuma cópia local afirmada |

## Verificações executadas da implementação

| Verificação | Estado neste relatório |
|---|---|
| Toolchain Java 21/Maven | Temurin 21.0.13+9 e Maven 3.9.11 instalados com checksums oficiais; javac, Maven e compilação real passaram |
| Instalação npm/workspace com lockfile | `npm ci --no-audit` passou; versões diretas exatas, lockfile preservado |
| Testes Java/Maven e empacotamento | Maven strict-checksums `verify`: 45 testes, 0 falhas/erros/ignorados; JAR gerado |
| Tipos/build frontend | `npm run typecheck` e `npm run build:frontend` passaram |
| Navegador e integração frontend/API Java | `npm run test:e2e`: 6 passaram, incluindo CRUD/reload, exportação, preservação de dados inválidos e bloqueio de entrega local; runner terminou com exit 0 |
| Supabase local e API Java reais | `npm run test:integration`: 12 verificações passaram com Auth/PostgREST/RLS e JAR reais; usuários descartáveis removidos; nenhum Canvas real acessado |
| SQL isolado | 13 cenários passaram na preparação anterior; não repetidos nesta migração, pois a migração SQL não mudou. Não somar como testes novos Java |
| Netlify frontend | `netlify build --offline` passou com build estático; sem Functions Java/TypeScript e sem publicação |
| Auditoria npm de produção | 0 vulnerabilidades reportadas; não é prova de ausência de todos os riscos |
| Startup backend isolado | `dev:backend` carregou `.env.local` temporário com PORT=18082 e respondeu health JSON; fixture removida, sem sobrescrever configuração do usuário |
| Cópia local assistida | Instalador executado em destino temporário com espaços; frontend/backend/template copiados; credenciais/caches excluídos; destino preenchido recusado e preservado |
| Dockerfile backend | Imagens verificadas no registro e fixadas por digest; build Docker não executado nesta revisão |
| Acesso Canvas real | Não verificado |
| Criação/configuração Supabase e Netlify hospedados | Não executada por esta revisão documental |
| Publicação, push e entrega Poliweek | Não executados |

A consolidação principal deve substituir os estados acima apenas após os comandos específicos terminarem, preservando exit codes e distinguindo testes passados, falhos, ignorados e não executados. Um build, processo vivo ou anexo de token não prova autenticação administrativa, publicação nem entrega acadêmica real.

## Falhas diagnosticadas e correções

- O primeiro empacotamento encontrou respostas 502 do Maven Central durante download de plugins. Uma execução posterior com os artefatos disponíveis e checksums estritos completou o build; o `verify` final executou todos os 45 testes.
- A revisão independente identificou que o startup isolado do backend ignorava `.env` e o truststore do processo Spring filho. Os dois modos agora compartilham `scripts/backend.mjs` e `environment.mjs`; o startup isolado foi exercitado com porta definida por arquivo.
- O seletor de proxy tratava incorretamente entradas NO_PROXY com porta padrão e IPv6. A correção normaliza portas e colchetes; quatro regressões passaram e foram incluídas nos 45 testes.
- Processos separados em grupos independentes atrasavam o encerramento do runner de navegador. O startup passou a manter o grupo herdado e encaminhar sinais; o runner final completou normalmente com 6 testes em 25,9 segundos.

O revisor independente voltou a examinar as duas correções de código e aprovou esse escopo sem editar arquivos nem repetir o build inteiro.

## Configuração de ambiente salva

`install_script` e `start_skill` foram substituídos por instruções Java/TypeScript testadas. Foram adicionados requisitos de `VITE_API_BASE_URL`, `APP_ALLOWED_ORIGINS` e `PORT`, preservando os requisitos anteriores.

Foram declarados, sem valores, acessos administrativos seguros `SUPABASE_ACCESS_TOKEN` para `api.supabase.com` e `NETLIFY_AUTH_TOKEN` para `api.netlify.com`; esses dois destinos foram acrescentados pelo mecanismo de segredos à rede restrita, preservando os presets existentes. Nenhum token foi publicado no código ou nos scripts de setup.

O save retornou status confirmado `saved`. Isso não aplica valores ausentes, não executa scripts e não publica um snapshot. Revisar/salvar os ajustes e publicar o ambiente continuam sendo ações do produto; uma restauração em tarefa nova não foi testada.
