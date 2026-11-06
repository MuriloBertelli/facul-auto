# Acesso persistente e entregas validadas

O login Supabase mantém a sessão neste navegador/dispositivo e renova o token
quando possível (`persistSession` e `autoRefreshToken` explícitos). A chave de
armazenamento padrão foi preservada para manter o login existente. “Sair da
conta”, também disponível no celular, encerra o acesso naquele navegador.
A senha não é guardada no código ou no chat. Sessões podem expirar ou ser
revogadas; a sessão Netlify não é compartilhada automaticamente com Sites.

Um próximo chat pode reutilizar as abas por conexão oficial e o ambiente
privado local quando disponíveis. O endereço Sites facilita o acesso à mesma
interface, mas não transfere senhas/sessões e não hospeda a JVM por si só.
Não solicitar senha pelo chat nem extrair cookies ou dados do perfil.

## Configuração local

O launcher encontra a configuração privada em
`~/.cache/campusflow-local/projects/<hash-do-checkout>/private.env`.
O arquivo deve pertencer ao usuário, ter modo 0600 e ficar em filesystem Linux.
O diretório deve ter modo 0700. `CAMPUSFLOW_ENV_FILE` permite indicar outro
arquivo privado. Não gravar novos segredos no exFAT.

`CANVAS_BASE_URL` aponta para a origem Canvas PUCPR confirmada. O token pessoal
fica somente em `CANVAS_API_TOKEN`, fora do frontend. A API valida a sessão
Supabase e o UUID proprietário antes de usar esse token. O padrão permanece
`CANVAS_SUBMISSIONS_ENABLED=false`.

## Certificados por arquivo

`scripts/canvas-certificates.py` complementa o envio de URL da API Java com um
procedimento local de arquivo `online_upload`. Não adiciona endpoint público
nem habilita entregas permanentes no aplicativo.

1. Consultar as atividades e os recibos existentes, ler os certificados e
   montar um plano privado. Cada item contém curso/atividade/título/prazo/URL
   e o caminho, tamanho e SHA-256 de cada PDF. Não alterar os PDFs.
2. Calcular `plan_sha256` sobre o JSON canônico sem essa própria chave
   (`sort_keys=True`, `ensure_ascii=False`, separadores `,` e `:`).
3. Mostrar ao usuário os destinos, os arquivos exatos, atrasos e entregas que
   serão preservadas. Aguardar sua validação explícita.
4. Registrar a resposta real em um arquivo privado 0600 com `approved:true`,
   `plan_sha256`, `user_response` e `approved_at`. Não criar aprovação com base
   apenas em um pedido genérico de continuar.
5. Executar primeiro a revisão de leitura abaixo. A execução real exige
   `--execute`, `--approval`, `--journal` e habilitação somente no processo.

```bash
python3 scripts/canvas-certificates.py \
  --plan /caminho/privado/delivery-plan.json \
  --sha256 SHA256_COMPLETO_VALIDADO \
  --env-file /caminho/privado/private.env

# Somente depois da validação específica registrada:
CANVAS_SUBMISSIONS_ENABLED=true python3 scripts/canvas-certificates.py \
  --plan /caminho/privado/delivery-plan.json \
  --sha256 SHA256_COMPLETO_VALIDADO \
  --env-file /caminho/privado/private.env \
  --approval /caminho/privado/approval.json \
  --journal /caminho/privado/receipts.json --execute
```

O procedimento verifica todos os arquivos e destinos antes de qualquer POST,
confere a identidade Canvas, preserva entregas existentes e registra cada
despacho antes da chamada. Faz upload multipart com o arquivo por último,
sem repassar o token Canvas ao armazenamento. Usa `on_duplicate=rename`.
Confirma o recibo e os IDs dos anexos após cada entrega. Não repete POST
automaticamente. Se a rede falhar, uma nova execução só reconhece um envio
anterior quando o recibo corresponde; caso contrário, interrompe para revisão.

O registro pode conter dados acadêmicos e URLs temporárias de anexos: mantê-lo
privado, fora do Git. Relatar sucesso somente com recibo confirmado.
O plano Poliweek e a revisão desta sessão ficam em
`~/.cache/campusflow-local/poliweek/`; conferir a conversa para a aprovação.

Referências do protocolo: [File Uploads](https://developerdocs.instructure.com/services/canvas/basics/file.file_uploads)
e [Submissions](https://developerdocs.instructure.com/services/canvas/resources/submissions).
