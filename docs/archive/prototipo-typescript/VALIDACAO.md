# Evidências da preparação

O checkout começou vazio, sem commits e sem branch `main` no remoto. O pedido atual autorizou criar esta base. Os arquivos estão no checkout local; não houve commit, push, deploy de site ou entrega real no Canvas.

## Verificado nesta máquina

| Verificação | Resultado observado |
|---|---|
| Instalação repetida com `npm ci --no-audit` | Concluída pelo lockfile; nenhum ajuste automático de versões |
| `npm run typecheck` | Passou |
| `npm test` | 37 testes da API passaram; nenhum falhou ou foi ignorado |
| `npm run test:e2e` | 6 testes Chromium passaram: rotas API, CRUD com reload, URL HTTPS, bloqueio de entrega local, exportação e preservação de armazenamento inválido no celular |
| `npm run test:db` / runner SQL equivalente | 13 cenários PostgreSQL passaram, incluindo reaplicação da migração, CRUD, RLS entre usuários, acesso anônimo, deduplicação Canvas e restrições |
| Supabase local | PostgreSQL, Auth e Kong saudáveis; PostgREST em execução; verificações de saúde mantidas |
| `npm run db:start` repetido; `db:stop` e novo `db:start` | Concluídos pelos scripts salvos, sem apagar volumes |
| `npm run test:integration` | 9 verificações com Auth/PostgREST reais passaram; usuários descartáveis removidos; Canvas simulado |
| `npm run build` | Build de produção concluído |
| `netlify build --offline` | Build e empacotamento da função `api.ts` concluídos, sem publicação |
| Auditoria npm de produção | 0 vulnerabilidades reportadas; isso não comprova ausência de todos os defeitos |
| GitHub Actions | YAML validado contra schema; ações fixadas por SHA consultado nos remotos oficiais; execução hospedada ainda não realizada |
| Reinício da interface/API | `npm run dev` voltou a responder JSON `status=ok` no health check |

Os testes SQL isolados usam uma implementação local de `auth.uid()` para testar políticas. Os nove testes de integração adicionais verificam também o Supabase Auth/PostgREST de verdade. Nenhuma resposta simulada conta como acesso ao Canvas da faculdade.

## Revisão independente e correções

Um agente em modo somente leitura reproduziu dois problemas e voltou a revisar as correções:

- Uma resposta perdida após POST de entrega podia incentivar repetição. Agora a API marca resultado desconhecido e a interface orienta conferir o recibo Canvas antes de qualquer nova tentativa, fecha a confirmação e não repete automaticamente.
- Armazenamento local inválido podia ser substituído por exemplos. Agora o conteúdo original fica intacto, com gravação bloqueada, download de recuperação e reinicialização somente após confirmação explícita. O navegador verificou preservação também após edição e reload.

O revisor aprovou as correções nesse escopo. Ele executou quatro regressões de API já contadas na suíte e verificações específicas do parser; não são testes adicionais somados ao total da suíte.

## Configuração persistida

O draft do ambiente recebeu `install_script`, `start_skill`, o checkout `facul-auto` com HEAD unborn verificado e sete requisitos de variáveis não secretas. `CANVAS_SUBMISSIONS_ENABLED` foi sugerido como `false`. As regras de rede existentes foram preservadas. Nenhum valor do token foi salvo nos scripts, código ou requisitos.

Salvar o draft não executa scripts, não publica o ambiente e não comprova restauração em nova tarefa. Revise e salve as alterações nos ajustes do ambiente e depois publique o ambiente pelo produto quando desejar preservar o snapshot preparado. Esta preparação não afirma que essa publicação ou uma restauração nova já ocorreram.

## Pendências externas

- Informar a origem HTTPS do Canvas da faculdade; verificar o token somente nesse destino e cadastrar o binding seguro `CANVAS_API_TOKEN` para tarefas futuras.
- Escolher/configurar o projeto Supabase hospedado e o usuário proprietário; aplicar a migração no destino revisado.
- Escolher/configurar o site Netlify e os secrets/proteções de `production` no GitHub.
- Autorizar e realizar o primeiro commit/push para que os arquivos e o CI existam no GitHub. O remoto não ganhou commits nesta tarefa.
- Verificar login, CRUD e leitura Canvas no site publicado antes de habilitar entregas.

A integração externa permanece não verificada. Não há comprovante de entrega real nem site publicado por esta execução.
