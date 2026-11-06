# Atividades automáticas e entregas de grupo — 05/11/2026

Pedido atendido: as atividades devem aparecer automaticamente em **Meus
trabalhos**, com separação entre pendentes, concluídas e atividades de grupo.

## Comportamento

- Ao entrar, o aplicativo lê os trabalhos salvos e consulta todas as disciplinas
  ativas do Canvas. As atividades entram automaticamente no Supabase, sem
  precisar de Adicionar por atividade.
- A consulta se repete a cada cinco minutos enquanto a tela está visível, e ao
  voltar à tela se a última consulta tiver mais de um minuto. Há também
  **Atualizar Canvas**. Não são criadas entregas no Canvas.
- A visualização inicial é **Pendentes**. **Concluídos** inclui as entregues,
  avaliadas sem envio online e dispensadas, cada uma com sua própria indicação.
  As atividades ficam agrupadas por disciplina, com busca e filtros de
  disciplina e tipo (individuais/em grupo).
- Entregas confirmadas em atividades de grupo aparecem como **Entregue em
  grupo**. O aplicativo não identifica nem inventa qual integrante clicou em
  enviar. Uma entrega de grupo vinculada à conta continua concluída mesmo
  quando foi enviada por outro integrante.
- Uma avaliação sem envio online tem indicação própria; uma nota automática
  acompanhada de `missing` não é tratada como entrega. Dispensas e solicitações
  de reenvio também são distinguidas.
- O próximo prazo considera pendências futuras. Prazos vencidos permanecem nas
  pendências, com indicação de atraso, e não são chamados de próximo prazo.

Referências primárias usadas para os campos do Canvas:
[Assignments](https://developerdocs.instructure.com/services/canvas/resources/assignments)
e [Submissions](https://developerdocs.instructure.com/services/canvas/resources/submissions).
Não se usa `has_submitted_submissions` (envios de qualquer aluno) como prova de
conclusão da conta atual.

## Preservação e isolamento

A migração `20261105010000_canvas_sync.sql` acrescenta o snapshot `canvas_sync`
e a função `sync_canvas_assignments`. A função é **SECURITY INVOKER**, usa
`auth.uid()` como proprietário, preserva RLS e não permite execução por `anon`.
O UUID não é aceito do payload como identidade do proprietário.

O conflito por proprietário/curso/atividade torna as atualizações repetidas e
concorrentes idempotentes. A sincronização atualiza os campos do Canvas e
preserva anotações, URL do projeto e progresso pessoal ainda pendente.
Atividades reabertas pelo Canvas voltam às pendências. A função nunca exclui
trabalhos pessoais ou atividades que não vieram na resposta.

Os campos vindos do Canvas são apresentados como leitura no editor; anotações
e links continuam editáveis. Atividades sincronizadas são mantidas pela
sincronização, sem botão de exclusão local. Trabalhos pessoais mantêm o CRUD.
Uma resposta atrasada de sincronização não substitui notas/links de uma edição
mais recente na tela. Falhas parciais mantêm os dados salvos e mostram aviso.

A interface faz no máximo três leituras de disciplinas em paralelo e grava
lotes de até 100 atividades. A função aceita até 200 itens por chamada. Nenhum
POST de entrega Canvas integra esse fluxo. Tokens e autenticação do backend
permanecem privados; `CANVAS_SUBMISSIONS_ENABLED=false` não foi alterado.

## Evidência real

A migração foi aplicada ao projeto **CampusFlow `sbdpgdmjtksmshurpywm`** pelo
SQL Editor, depois da validação em cluster descartável. A consulta de catálogo
retornou: RLS=true, RLS forçado=true, coluna de snapshot presente,
security_invoker=true, anonymous_execute=false e authenticated_execute=true.

Com a sessão proprietária existente, o aplicativo sincronizou **82 atividades**
sem avisos: **51 pendentes e 31 concluídas**, com **10 entregas em grupo** no
conjunto consultado. São dados reais do usuário, importados a seu pedido;
nenhum registro fictício foi inserido no banco hospedado.

Em **Gestão de Projetos** foram conferidas **19 atividades**:

| Situação | Quantidade |
|---|---:|
| Pendentes | 7 |
| Concluídas | 12 |
| Das concluídas, entregues em grupo | 9 |
| Das concluídas, entregas individuais | 3 |

As contagens são um snapshot da consulta, não valores fixos da aplicação.
O estado e os prazos vêm do Canvas; nenhum envio acadêmico foi realizado.

## Verificações

- `npm run check` pelo launcher: tipos/build e **52 testes Java**, sem falhas,
  erros ou testes ignorados. As sete regressões novas cobrem conclusão em
  grupo, falta com nota, avaliação sem envio, dispensa, reenvio, revisão pendente
  e proteção contra atribuir envios de outros alunos à conta atual.
- `npm run test:e2e`: **9 testes passaram** em 11,7s (oito testes de navegador
  e um teste de merge). Inclui login/sincronização automáticos em fixture
  isolada, filtros, cinco minutos de atualização, reload sem duplicatas,
  preservação após falha, ausência de POST Canvas e as seis regressões antigas.
- `npm run test:db:native`: ambas as migrações aplicadas duas vezes e testes
  SQL/RLS aprovados em PostgreSQL 18 descartável. As novas verificações cobrem
  idempotência, notas/URL/progresso preservados, conclusão de grupo, reabertura,
  validação, usuário forjado, isolamento entre proprietários e bloqueio anônimo.
- O teste móvel encontrou expansão dos cartões de resumo por conteúdo longo.
  `min-width: 0` corrigiu a causa; a verificação de largura voltou a passar,
  sem alterar o assert ou esconder overflow da página.
- `package:netlify`: tipos/build e ZIP estático aprovados. O token Canvas não
  aparece no bundle/ZIP e o lockfile de dependências permanece inalterado.

Logs persistidos em `~/.cache/campusflow-local/evidence/campusflow-auto-*.log`.
Captura privada: `campusflow-auto-group-deliveries.png` no mesmo diretório.

## Publicação e limite atual

Frontend atualizado manualmente no site existente
`https://campusflow-murilobertelli.netlify.app`, sem Git/CI/CD:

- Site: `42494a22-bd34-42a7-880d-d134a83b10ef`.
- Deploy: `6aed36c032dab90650f9600d`.
- ZIP SHA-256: `930df6b750b0725bd6ded2a5e0422a8fae63320523974b5645c90dda59f5d994`.

A API Java continua em `http://127.0.0.1:8080` e o aplicativo local em
`http://127.0.0.1:8888`. É nessa tela que a atualização automática do Canvas foi
verificada. O site publicado lê as mesmas atividades salvas no Supabase,
incluindo a separação de grupo, mas novas consultas Canvas no site ainda
dependem de selecionar um host HTTPS para a API e reconstruir o frontend com
`VITE_API_BASE_URL`. A interface informa quando mostra dados salvos sem a API.

Nenhum commit/push, nova dependência, plano pago, alteração em outro projeto
ou ativação de entrega Canvas foi realizado nesta atualização.
