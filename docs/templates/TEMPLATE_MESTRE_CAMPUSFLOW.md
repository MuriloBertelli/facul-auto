# TEMPLATE MESTRE PREENCHIDO — CAMPUSFLOW

Este documento aplica o template original à arquitetura atual antes da implementação desta mudança. O [original recebido](TEMPLATE_MESTRE_ORIGINAL.md) está preservado sem alterações. Campos desconhecidos são explícitos; valores de credenciais nunca integram o documento.

## 0. Ficha do contexto

| Campo | Preenchimento |
|---|---|
| Nome da iniciativa | Automação e organização de atividades acadêmicas e entregas Canvas |
| Sistema/projeto | **CampusFlow**, no repositório GitHub `MuriloBertelli/facul-auto` |
| Contexto e motivo | Reduzir o esforço diário para acompanhar atividades, prazos e atrasos no Canvas da PUCPR; preparar trabalhos e sua entrega com revisão do usuário |
| Objetivo final solicitado | Teste inicial com relatórios Poliweek no Canvas; identificação das atividades, arquivos e autorização de cada envio real ainda precisam ser verificadas |
| Tipo de tarefa | Planejamento, implementação, preparação de ambiente e execução de testes pertinentes |
| Modo de execução | Implementação local na nuvem; integrações remotas dependem de autenticação administrativa e destino verificado |
| Escopo incluído | Backend Java 21/Spring Boot em `backend/`; frontend TypeScript/JavaScript em `frontend/`; interface responsiva; dados/Auth Supabase; configuração Netlify para frontend; conexão Canvas pela API; conta proprietária única; testes e documentação |
| Fora do escopo nesta revisão | CI/CD automático e deploy direto, conforme linha explícita do template mais recente; nenhum envio real Canvas, push ou publicação executado somente por conveniência |
| Comportamentos que não podem mudar | Token Canvas apenas no servidor; isolamento dos dados por usuário; login único do proprietário; revisão e confirmação por entrega; preservação do template original e dos trabalhos locais |
| Critérios de aceite | Estrutura frontend/backend separada; Java 21 compilando e testes pertinentes executados; frontend com tipos, build e testes; API iniciada e requisição funcional; integração real reportada separadamente |
| Urgência/prioridade | Facilitar rotina entre trabalho e faculdade; prazo específico: A DESCOBRIR NO G0 |
| Contexto histórico de apoio | Protótipo anterior React/TypeScript + Netlify Functions; testes e workflow daquele protótipo são históricos e não validam o novo backend Java |
| Pontos pendentes conhecidos | URL Canvas; projeto Supabase; site Netlify; autenticação administrativa nos serviços; UUID proprietário; destino de hospedagem JVM; atividades/artefatos Poliweek; significado de “certificado no banco” |

### Ambiente e fontes

- Skills indicadas no template: `C:\Users\MuriloBertelli\work\sistemas\Skills`; caminho local Windows não acessível nesta máquina Linux de nuvem.
- Skill aplicável disponível: `cloud-environment-onboarding:setup`; nomes de outras skills no catálogo são referências, não evidência de instalação.
- Checkout real: `/workspace/facul-auto`.
- Diretório final solicitado pelo usuário: `/run/media/kali/Extreme SSD/04-dev/auto-faculdade`; não montado neste ambiente. Não afirmar cópia ou instalação nesse SSD.
- Worktree adicional: NÃO SE APLICA. Reutilizar o checkout isolado da tarefa.
- Branch: `work`; HEAD inicial sem commit, antes do protótipo; estado atual deve ser reconferido no G0.
- Base de comparação: arquivos locais anteriores à migração Java, sem inventar SHA.
- Documentos: este template preenchido, original recebido, `docs/CONTEXT.md`, `docs/ARQUITETURA.md`, `docs/CONFIGURACAO.md`, código e resultados de testes desta revisão.
- Ambiente de execução: nuvem de desenvolvimento e containers locais isolados. Serviços hospedados não se presumem provisionados.
- Azure: NÃO SE APLICA.
- Ferramentas: Java 21, Maven, Node/npm, TypeScript/Vite/React, Docker, Supabase CLI; Netlify para o frontend estático.

### Permissões desta execução

| Operação | Autorizada? | Condição/limite |
|---|---|---|
| Ler código/configurações locais | SIM | Checkout e documentos de escopo; segredos apenas por mecanismos seguros, sem exibir valores |
| Leitura de infraestrutura | SIM, quando autenticada | Operações de consulta no projeto/conta informados, sem inferir permissão administrativa a partir do token Canvas |
| Alterar arquivos locais | SIM | Implementação CampusFlow e configuração/documentação associadas; preservar histórico relevante |
| Commits locais | A DESCOBRIR NO G0 | Não necessários para validar a implementação; não executar sem escopo definido |
| Testes e containers locais | SIM | Recursos isolados, dados fictícios e sem conexões acidentais de produção |
| `git push` | NÃO NESTA ETAPA | Usuário descreveu push como etapa posterior; não executado nesta mudança |
| Criar PR | NÃO NESTA ETAPA | A DESCOBRIR NO G0 quando houver pedido específico |
| Merge/rebase | NÃO AUTORIZADO | Nenhum pedido específico |
| Criar recursos Supabase/Netlify | SOLICITADO, BLOQUEADO POR PRÉ-REQUISITOS | Necessita sessão/autorização administrativa no serviço correto, destino e escopo; token Canvas não administra esses serviços |
| Deploy | FORA DO ESCOPO ATUAL | A linha específica do template mais recente prevalece sobre intenção genérica de publicação |
| Enviar dados externamente | LIMITADO | Leituras Canvas autorizadas quando configuradas; nenhuma entrega acadêmica real sem atividade, artefato e confirmação específicos |

A senha da conta `mrlbertelli@gmail.com` será definida pelo usuário no fluxo seguro do serviço. Não gerar, pedir em chat, registrar ou publicar essa senha. “Certificado no banco” permanece **A DESCOBRIR NO G0**; não inventar certificado, PKI ou um mecanismo de autenticação diferente do pedido.

## 1. Missão do orquestrador

Preparar o CampusFlow com frontend TypeScript/JavaScript e backend Java 21 separados, preservando contratos e evidências. Decompor o trabalho, integrar as entregas, executar verificações reais e distinguir preparação local de acesso a serviços e de publicação. Nenhuma conclusão vira fato pela repetição entre agentes.

## 2. Seleção de skills e contratos de agentes

Skills do catálogo do template (`tech-lead`, `spec-driven-development`, `backend-specialist`, `frontend-specialist`, `devsecops` e outras): **INDISPONÍVEIS nesta máquina quando não confirmadas pelo catálogo da sessão**. Não simular sua execução. Os identificadores abaixo são agentes reais de implementação, não skills instaladas.

| ID | Papel exclusivo | Escopo de escrita | Fontes e perguntas técnicas | Entregáveis/aceite | Revisor |
|---|---|---|---|---|---|
| `/root` | Integração e ambiente | Pacotes/configuração raiz, scripts, startup e persistência da configuração | Contratos das partes; Java/Node reais; como iniciar frontend/API e repetir instalação? | Instalação/testes/builds e requisição funcional registrados | Revisão cruzada quando disponível; declarar auto-revisão |
| `/root/api_canvas` | Backend Java e integração Canvas | `backend/**` e testes próprios | Contrato API, validação Supabase, token servidor, confirmação por envio; não acessar credencial anexada como material de código | Java 21/Spring Boot com testes de autenticação, isolamento, validação e falhas remotas | `/root` integra; revisão independente: A DESCOBRIR NO G0 |
| `/root/interface` | Frontend e experiência de uso | `frontend/**` | Login único, tarefas/prazos, modo local explícito, URL da API; como conectar frontend sem embutir segredos? | Interface responsiva e contrato HTTP alinhado | `/root` integra; revisão independente: A DESCOBRIR NO G0 |
| `/root/java_toolchain` | Java/Maven reproduzíveis | `scripts/java-toolchain.sh`, `scripts/maven.sh`, cache `/workspace/.tools/**` | Distribuições oficiais Temurin/Maven; instalação sem alterar `HOME`, verificações SHA256/SHA512 e strict-checksums | `javac`/Maven nas versões fixadas e uso do toolchain pelo backend | `/root` integra |
| `/root/delivery_ci` | Contexto, arquitetura e configuração de publicação | `docs/**`, README, `.env.example`, `netlify.toml`, `.github/**` | Template original, conflitos de escopo e limites JVM Netlify | Original preservado, template preenchido, CI arquivado, Netlify frontend apenas | `/root` |
| `/root/independent_review` | Revisão independente sem escrita | Leitura de código e regressões pertinentes | Autenticação, CORS, proxy, startup e transferência; sem ler credenciais | Dois problemas reproduzidos, correções reavaliadas e evidências conferidas | Parecer independente entregue ao `/root` |

O esquema Supabase e seus testes já tinham sido preparados na etapa anterior por `/root/supabase_data`; esse trabalho é reaproveitado e o agente não foi listado como ativo nesta revisão.

Baseline de todos os contratos: protótipo local anterior e arquivos reais reconferidos no G0; nenhum SHA foi inventado. Operações permitidas: leitura, escrita nas pastas exclusivas e verificações pertinentes. Proibidas: credenciais em código/documentos, alterações concorrentes no mesmo arquivo sem acordo, publicação externa por iniciativa do agente, produção como fixture e falsos resultados.

## 3. Protocolo de evidências

Usar **evidência → interpretação → teste/contraprova → conclusão → confiança → impacto → recomendação**. Registrar para cada achado ID, classificação, arquivo/log/comando, contexto, confiança, contraprova, risco e tratamento. Conversas e relatórios anteriores são pistas históricas. Distinguir não encontrado, não verificado, não aplicável e inexistência comprovada. Testes simulados não comprovam acesso hospedado ou entrega Canvas.

## 4. Fases e gates

| Gate | Saída e prova necessária | Estado inicial desta revisão |
|---|---|---|
| G0 — Estado real | Caminhos, branch/HEAD, arquivos, ferramentas, bindings por nome e acesso ao SSD | Reconferir; SSD local não acessível na nuvem |
| G1 — Arquitetura | `docs/ARQUITETURA.md`: frontend Netlify, API Java separada, Supabase, Canvas, autenticação | Decisão registrada; host JVM A DESCOBRIR NO G0 |
| G2 — Delegação | Contratos acima, fronteiras de arquivo e pareceres individuais | Registrado antes da implementação da revisão |
| G3 — Contraprovas | Revisão dos riscos de autenticação, proprietário, envio e CORS | A executar sobre a implementação Java |
| G4 — Implementação | Arquivos frontend/backend, variáveis sem valores secretos e startup reproduzível | A executar/validar pelos responsáveis |
| G5 — QA | Tipos/build/frontend, testes Java, testes de banco isolado e smoke HTTP | Resultados Java ainda não verificados neste documento |
| G6 — Handoff | Evidências, bloqueios externos, cópia ao SSD e publicação distinguidos | Pendente da consolidação principal |

Não ajustar asserts, limiares, verificações TLS ou políticas para produzir testes verdes. Preservar exit codes e diferenciar testes passados, falhos, ignorados e não executados.

## 5. Segurança operacional

O token Canvas é segredo de servidor. Variáveis `VITE_*` entram no navegador e nunca recebem tokens privados ou chaves de administração. Manter RLS e validação do proprietário, sem signup público. Testes usam dados fictícios e banco isolado. Uma credencial válida em um serviço não comprova acesso a outro.

A solicitação de criação Supabase/Netlify autoriza preparação e investigação, mas não fornece a autenticação administrativa ausente. Completar o trabalho independente e registrar exatamente o requisito que impede a etapa remota. Não solicitar valores de segredos no chat.

## 6. Matriz inicial de riscos

| ID | Item | Evidência | Classificação | Impacto | Condição | Responsável/gate | Tratamento |
|---|---|---|---|---|---|---|---|
| ARQ-001 | JVM no Netlify | Netlify hospeda frontend e funções suportadas, não aplicação Java persistente neste desenho | CONFIRMADO como limite da arquitetura adotada | Backend não inicia se tratado como frontend | Tentar hospedar Spring Boot como função Node | `/root`, G1 | API Java em host/container separado; host ainda não selecionado |
| AMB-001 | SSD solicitado | Caminho local do usuário fora dos mounts desta nuvem | BLOQUEADO | Não instalar diretamente no destino final | SSD não montado | `/root`, G0/G6 | Preparar checkout/arquivo de transferência; não afirmar cópia |
| IAM-001 | Admin Supabase/Netlify | Somente token Canvas foi informado até esta revisão | BLOQUEADO | Criação de recursos e conta não comprovadas | Sessões administrativas ausentes | `/root`, G6 | Reutilizar autenticação existente se disponível; solicitar fluxo seguro específico quando necessário |
| ESC-001 | CI/CD e deploy | Contexto genérico pede publicação, linha específica exclui CI/CD e deploy direto | CONFIRMADO | Publicação fora do escopo atual | Workflow antigo permanecesse ativo | `/root/delivery_ci`, G2 | Arquivar workflow anterior e documentar decisão |
| QA-001 | Evidência histórica | Testes do protótipo TypeScript antecedem backend Java | CONFIRMADO | Conclusão falsa de prontidão Java | Reutilizar contagens sem novos testes | Todos, G5 | Marcar relatório antigo como histórico e coletar resultados Java atuais |
| REQ-001 | “Certificado no banco” | Termo sem definição técnica no template | NÃO VERIFICADO | Implementar mecanismo diferente do desejado | Assumir PKI sem confirmação | `/root`, G0 | Manter pendência explícita; validar autenticação efetiva |

## 7. Formato do relatório final

Consolidar nesta ordem: **A** resumo executivo; **B** estado real; **C** arquitetura e dependências; **D** agentes realmente executados; **E** mudanças, lógica e propósito; **F** riscos; **G** QA executado/não executado; **H** arquivos e recursos alterados; **I** pendências; **J** GO/NO-GO por gate; **K** próximos passos permitidos. Escalar detalhe ao que foi efetivamente executado, com links para os documentos de apoio.

## 8. Critério de encerramento

Encerrar a etapa local quando estrutura Java/frontend, instalação, startup e verificações pertinentes estiverem executados e documentados, ou quando um bloqueio externo concreto impedir o restante. Não afirmar Supabase/Netlify provisionados, SSD atualizado, Canvas entregue ou Java validado sem evidência específica. Preservar este contexto para a próxima tarefa sem exigir que o usuário reescreva o documento.

## Consolidação após a execução

G1 a G5 foram exercitados no checkout de nuvem: Java 21 com 45 testes, frontend com tipos/build e 6 testes de navegador, integração real Java/Supabase local com 12 verificações. A revisão independente validou as correções de startup e proxy. Consulte `../VALIDACAO.md` e `../RELATORIO_FINAL.md`.

G0/G6 permanecem parcialmente bloqueados para SSD e serviços hospedados: o disco local não está montado, faltam bindings administrativos/destinos e a URL Canvas deve ser confirmada. A senha pessoal não foi gerada. O objetivo de leitura IA e teste Poliweek permanece pendente de fontes, provedor e artefatos específicos, sem envio real executado.
