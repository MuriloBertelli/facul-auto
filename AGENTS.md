# Continuação do CampusFlow

Use este checkout existente. Não criar outro clone/worktree nem sobrescrever a
extração. Em exFAT, executar npm por `bash scripts/local.sh npm ...`; dependências
e toolchains ficam no cache Linux, fora do SSD.

Estado e procedimentos atuais: `docs/ACESSO_E_ENTREGAS.md`,
`docs/MOBILE_E_PUBLICACAO.md` e `docs/SINCRONIZACAO_CANVAS.md`.
Os documentos em `docs/archive/` e os templates originais são históricos.
As instruções posteriores do usuário prevalecem sobre esse histórico.

Nunca colocar senhas, token Canvas, chaves administrativas, PDFs acadêmicos,
aprovações ou recibos no Git, frontend ou relatórios públicos. Não extrair
cookies/perfis/sessões do navegador. Reutilizar conexão oficial autenticada e
o arquivo privado externo reconhecido pelo launcher.

Cada entrega real exige validação específica do usuário sobre atividade,
destino e arquivos/URL. Habilitar uma integração não substitui essa validação.
Não repetir POST com resultado desconhecido; consultar recibo primeiro.
Preservar entregas existentes, inclusive as feitas pelo grupo.

O usuário autorizou GitHub → Netlify automático e uma segunda publicação no
Sites, após as entregas Poliweek validadas e confirmadas. Os três recibos
foram confirmados; conferir o estado remoto e a documentação de publicação.
Cada nova entrega exige sua própria validação específica.
Preservar `origin`, o site Netlify existente e o ID em `.openai/hosting.json`.
Nunca executar `create_site` novamente para este projeto.

Testes usam dados fictícios e configuração externa vazia. Não usar o Supabase
hospedado como fixture ou resetar dados pessoais. Antes dos E2E, encerrar apenas
o servidor dev pertencente a este checkout; o runner não o reutiliza.
