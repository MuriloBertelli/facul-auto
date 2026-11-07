# Celular e publicações

## Implementado localmente

- Layout de 320 px em diante, navegação que quebra em linhas, filtros em uma
  coluna, títulos longos sem rolagem horizontal e cartões legíveis.
- Botões de ação com pelo menos 44 px no celular, campos de 16 px para evitar
  zoom automático, áreas seguras de tela e diálogos com rolagem vertical.
- Acesso a “Sair da conta” no celular e sessão persistente por dispositivo.

Verificação realizada em 05/11/2026, America/Sao_Paulo:

| Verificação | Resultado |
|---|---|
| `bash scripts/local.sh npm run check` | Tipos, build e 52 testes Java aprovados |
| `bash scripts/local.sh npm run test:e2e` | 13 cenários aprovados, sem fixture hospedada |
| Celular autenticado em 320/360/390/430 px | Busca, filtros, nome longo, diálogo, sessão após reload e logout aprovados; sem overflow horizontal |
| `python3 -m unittest discover -s scripts -p test_canvas_certificates.py` | 10 cenários aprovados, sem acesso externo |
| Revisão de leitura do plano Poliweek real | 3 atividades/5 anexos validados antes dos envios |
| Execução autorizada Poliweek | 3 recibos confirmados; 5 anexos; duas entregas existentes preservadas |
| Sincronização posterior | 82 atividades: 48 pendentes e 34 concluídas; 10 entregas em grupo |
| Servidor pessoal restaurado | Health OK, Supabase/Canvas configurados, entregas desabilitadas |

Os cenários incluem preservação das entregas de grupo e anotações, falhas de
leitura, mudanças de PDF/destino, resultado desconhecido de POST sem repetição,
upload multipart e ausência de token em requisição ao armazenamento.
O Chromium local foi usado; não houve teste em iPhone/Android físico.

## Ordem autorizada pelo usuário

O usuário validou explicitamente os três envios do plano Poliweek. O Canvas
confirmou os três recibos em 05/11/2026, às 23h50–23h51 (America/Sao_Paulo),
com cinco anexos no total. As duas entregas já existentes em Gestão foram
conferidas e permaneceram inalteradas. Plano, validação e recibos permanecem
no cache privado, fora do Git. A publicação dos fontes pode prosseguir.
Cada nova entrega continua exigindo validação específica.

Procedimento de publicação autorizado:

1. Atualizar/sincronizar os dados do organizador.
2. Publicar os fontes reais no repositório GitHub já existente,
   `MuriloBertelli/facul-auto`, branch `main`. Preservar `origin` e não forçar
   alterações remotas. O repositório consultado estava vazio.
3. Ligar o **site Netlify existente** `campusflow-murilobertelli` a esse repo.
   Usar `netlify.toml`: build `npm run build:frontend`, publish `frontend/dist`.
   Publicação automática por push em `main`, sem necessidade de GitHub Actions.
4. Publicar o mesmo código no Sites, preservando o projeto registrado e a
   audiência privada. A integração automática solicitada é GitHub → Netlify;
   não presumir GitHub → Sites automático.

## Sites

Identidade registrada e preservada em `.openai/hosting.json`:
`appgprj_6aed3c668ac88191a27361f25f3107f6`.
Publicado com sucesso em 05/11/2026, às 23h57 (America/Sao_Paulo),
com audiência privada para a conta proprietária. Não chamar `create_site` novamente.

URL publicada:
`https://campusflow-murilobertelli.mrlbertelli.chatgpt.site`.
O site de referência do amigo não foi alterado. No primeiro acesso, é preciso
entrar na conta ChatGPT proprietária. A sessão Supabase do aplicativo continua
separada por origem. O retorno exato do Sites foi adicionado à allowlist Auth
do Supabase, preservando Netlify e as duas origens locais.

```bash
bash scripts/local.sh npm run build:frontend
python3 scripts/package-sites.py
```

O adaptador copia apenas a saída Vite para `dist`, diretório estático declarado
no manifest. Usar o source helper do plugin Sites nesse mesmo checkout para
commit/push e pacote; passar credencial por stdin, sem arquivos/argumentos.
Depois usar a operação de publicação privada com o SHA e archive exatos.
Renovar a credencial de fonte se expirada, sem criar outro Site.

## Estado GitHub e Netlify

Os 90 arquivos de fonte foram publicados em `MuriloBertelli/facul-auto`,
branch `main`; o checkout local mantém os mesmos commits, árvore e `origin`.
Nenhum segredo ou PDF acadêmico foi incluído.

O frontend responsivo foi publicado no site Netlify existente em 06/11/2026,
às 00h02 (America/Sao_Paulo), deploy `6aed433244d5f6f47c51db29`.
As respostas HTTPS e os bytes dos assets JS/CSS foram conferidos contra o
build local. As cinco atividades Poliweek aparecem como entregues no site.

A ligação contínua GitHub → Netlify foi configurada em 07/11/2026. O usuário
concluiu a autenticação e autorizou explicitamente o acesso do aplicativo
Netlify a `facul-auto`, preservando os dois repositórios já selecionados.
O site existente agora aponta para `MuriloBertelli/facul-auto`, branch `main`,
com base na raiz, build `npm run build:frontend`, publicação `frontend/dist`
e nenhuma função do backend antigo. As variáveis públicas existentes foram
preservadas. Não foi contratado plano pago nem criado outro site Netlify.

O primeiro build a partir do repositório usa o commit `5b9ef0f`. Esta atualização
da documentação também é publicada no GitHub para verificar o disparo de um
novo deploy pela integração. Conferir a associação entre commit e deploy no
painel Netlify; registros finais de implantação ficam no cache privado local.
A publicação automática vale para pushes na branch `main`; o Sites mantém
sua própria publicação e a audiência privada existente.

## Limitação que permanece

Netlify e Sites hospedam o frontend; o backend Java continua local. Os
trabalhos já sincronizados ficam no Supabase e aparecem depois do login, mas
novas consultas automáticas ao Canvas nos sites dependem de uma API Java HTTPS.
O destino JVM ainda não foi selecionado/provisionado. Não publicar o token
Canvas em `VITE_*` nem apresentar duas hospedagens estáticas como API ativa.

Depois de existir a API, configurar `VITE_API_BASE_URL`, CORS exato para as
origens utilizadas e reconstruir os dois frontends. Conferir o redirect Auth
do Supabase para a origem Sites sem wildcard. Manter RLS e cadastro restrito.
