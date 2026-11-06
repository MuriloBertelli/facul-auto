# Contexto preservado do Facul Auto

Este arquivo preserva o pedido conhecido para evitar depender de um texto não salvo na interface. É uma reconstrução a partir da mensagem atual do usuário e das decisões registradas nesta tarefa. **Não é uma recuperação do documento editado que desapareceu.**

## Pedido conhecido

O usuário pediu, em português:

> “Supa base, netlify, CI CD Github, Dependencias de bibliotecas abertas fixas, API dentro de dev auto. A ideia criar um ambiente de entrega de trabalhos web para o canvas da minha faculdade, e facilitar minha vida no dia dia com trabalho.... Use o template base ali para delegar com os agentes..”

O repositório escolhido é `MuriloBertelli/facul-auto`. O template base é uma referência de coordenação e evidências; o usuário esclareceu que ele não contém as edições perdidas.

## Decisões adotadas para executar o pedido

| Requisito | Implementação inicial |
|---|---|
| Supabase | Autenticação por e-mail/senha; tabela de trabalhos com RLS por usuário |
| Netlify | Site React/Vite e função de API no mesmo projeto |
| CI/CD GitHub | Tipos, testes de API, testes SQL isolados, build e auditoria; deploy condicionado aos gates de produção |
| Bibliotecas abertas fixas | Versões diretas exatas, árvore transitiva em lockfile, `npm ci`, ações GitHub fixadas por SHA |
| API dentro do projeto | Rotas `/api/*` em Netlify Functions, usadas pela interface autenticada |
| Canvas | Consultar disciplinas/atividades e entregar URL HTTPS após confirmação explícita |
| Dia a dia | Organizar trabalhos, prazos, situação, notas e endereço do projeto publicado |
| Agentes | Contratos por pasta, pareceres individuais e validação integrada; ver `ORQUESTRACAO.md` |

## Suposições explícitas

- “API dentro de dev auto” foi interpretado como API interna ao repositório **facul-auto**. Essa interpretação pode ser corrigida sem perder este contexto.
- O uso inicial é pessoal: o token Canvas pertence ao usuário proprietário, definido por `SUPABASE_OWNER_USER_ID`. Outros usuários Supabase não podem usar esse token.
- A entrega inicial é de **URL de site**, não upload de arquivos nem resolução automática de atividades. Tipos Canvas diferentes precisam de extensão própria.
- O aplicativo organiza e entrega trabalhos que o usuário prepara; não cria respostas acadêmicas em nome dele.
- Sem credenciais externas, o modo local usa dados de exemplo identificados e armazenamento no navegador.
- Os processos de desenvolvimento precisam reiniciar em novas tarefas. Deve-se reutilizar o checkout existente; não criar worktree para cada tarefa de nuvem.

## Informações ainda necessárias para a integração externa

| Informação | Estado e motivo |
|---|---|
| URL HTTPS do Canvas da faculdade | A informar; necessária para verificar o token e consultar as atividades reais |
| Projeto Supabase | A selecionar/configurar; são necessários URL, chave publishable e usuário proprietário |
| Site Netlify | A selecionar/configurar; necessário para publicar o organizador e sua API |
| Credenciais Netlify de CI | A configurar nos secrets de `production` do GitHub |
| Proteções do environment `production` | A configurar e revisar antes de habilitar o gate de deploy |

O usuário anexou um arquivo de token para a tarefa. Seu valor não consta neste documento, na configuração versionada ou no bundle. Um token anexado não substitui a configuração segura persistente dos serviços.

## Critérios de aceite por etapa

- Desenvolvimento: instalar pelo lockfile, iniciar interface/API, verificar resposta funcional e executar tipos, testes e build.
- Banco: aplicar a migração em PostgreSQL isolado e verificar restrições e isolamento por usuário; validar separadamente o Supabase hospedado quando configurado.
- Leitura Canvas real: autenticar o proprietário, consultar o domínio informado e confirmar disciplinas/atividades esperadas.
- Publicação: validar o site Netlify efetivo e os gates do GitHub; arquivos de configuração sozinhos não comprovam deploy.
- Entrega: conferir atividade, tipo `online_url`, URL final e confirmação explícita; não executar envios reais nesta tarefa sem essa ação do usuário.

Preservar este arquivo e registrar mudanças de requisito aqui nas próximas tarefas, sem incluir segredos. Resultados devem diferenciar verificado, falhou, não executado e bloqueado.
