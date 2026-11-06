# Contrato de execução e agentes

Este plano adapta o template base de orquestração fornecido pelo usuário. O documento editado e perdido não foi recuperado; não se presume que as instruções daquele arquivo sejam conhecidas. A orientação atual do usuário é a fonte de escopo.

## Contexto e limites

| Campo | Estado desta execução |
|---|---|
| Iniciativa | Facul Auto: organizar e entregar trabalhos web no Canvas |
| Repositório | `MuriloBertelli/facul-auto`, checkout `/workspace/facul-auto` |
| Baseline | Checkout vazio, branch local `work` sem commits; remoto sem `main` no início da tarefa |
| Stack solicitada | Supabase, Netlify, GitHub CI/CD, bibliotecas abertas com versões fixas e API no projeto |
| Objetivo verificável | Preparar implementação inicial, instalação reproduzível, interface e API executáveis, testes e configuração de entrega |
| Ambiente | Nuvem isolada da tarefa; reutilizar o checkout existente, sem criar worktree |
| Código | Novos arquivos autorizados pelo pedido atual; nenhum código anterior de aplicação foi encontrado |
| Fora do escopo | Resolver exercícios, enviar trabalhos reais nesta tarefa, merge/deploy/publicação de produção sem destino e autorização específicos |
| Credenciais | Não imprimir valores; não versionar anexos; configurar segredos somente nos mecanismos seguros |
| Dados | Demonstração explicitamente identificada; políticas de banco por usuário; token pessoal Canvas restrito ao proprietário |

## Agentes ativados

Os nomes abaixo são identificadores reais dos agentes desta execução, e não nomes de skills. As skills de catálogo citadas no template, como `tech-lead`, `frontend-specialist`, `devsecops` e `dba-sqlserver`, não estavam disponíveis e **não foram executadas**. A skill disponível de onboarding orienta a preparação do ambiente.

| Agente | Responsabilidade exclusiva de escrita | Entregável e critério de aceite |
|---|---|---|
| `/root` | Configuração de pacotes, lockfile, integração e ambiente | Instalação reproduzível, testes/build executados e instruções persistidas |
| `/root/interface` | `src/**` | Interface em português, modo local identificado, login/CRUD Supabase e confirmação de entrega |
| `/root/api_canvas` | `server/**`, `netlify/functions/api.ts`, testes de API | Autenticação, isolamento do proprietário, chamadas Canvas e testes de falha/limites |
| `/root/supabase_data` | `supabase/**` e teste de banco pertinente | Migração com RLS, restrições de dados e validação de isolamento |
| `/root/delivery_ci` | `.github/**`, `netlify.toml`, documentação e `.env.example` | CI fixado por SHA, CD protegido e requisitos externos documentados |
| `/root/independent_review` | Somente leitura | Revisão independente de autenticação, entrega e preservação dos dados; reprodução e reavaliação dos dois achados corrigidos |

Cada agente recebe contrato com fontes primárias, arquivos exclusivos, operações permitidas e critério de aceite. Nenhum agente pode ler ou copiar o token anexado para código. A escrita concorrente nos mesmos arquivos deve ser evitada. Integração e correções fora do contrato ficam com o responsável principal ou dependem de acordo explícito entre agentes.

Os pareceres iniciais são entregues individualmente. A integração pelo agente principal não representa revisão plenamente independente de mudanças que ele mesmo realizou. Uma revisão adicional precisa declarar exatamente o que verificou e quais evidências utilizou; repetir a conclusão de outro agente não a transforma em prova.

## Gates

| Gate | Evidência necessária |
|---|---|
| G0 — Estado inicial | Checkout, branch, ausência/presença de arquivos e bindings inspecionados sem revelar segredos |
| G1 — Implementação | Responsáveis e limites por arquivo definidos; contratos de frontend/API/banco alinhados |
| G2 — Validação local | Instalação com lockfile, tipos, testes úteis, build e requisição funcional à API |
| G3 — Serviços externos | Projeto/site/domínio corretos, credenciais utilizáveis e testes reais específicos |
| G4 — Publicação | CI aprovado, destino Netlify configurado e proteções de produção revisadas |
| G5 — Entrega Canvas | Atividade compatível, URL revisada, usuário proprietário e confirmação explícita por envio |

Um gate bloqueado por credencial ou destino ausente não conta como sucesso. É permitido concluir implementação e validação local enquanto serviços externos aguardam configuração. Nenhum teste simulado comprova envio real, deploy ou acesso ao banco hospedado.

## Handoff

Preservar as versões do lockfile; futuras atualizações entram em PRs revisáveis. Iniciar a interface e a API conforme as instruções do ambiente, pois processos vivos não sobrevivem necessariamente à publicação de um snapshot. Informar resultados executados, falhas diagnosticadas, verificações não executadas e o próximo passo concreto sem inventar recursos ou aprovações.
