# Relatório CampusFlow — migração Java/TypeScript

> Este relatório descreve a sessão anterior, na nuvem. A continuação no SSD,
> com instalação e testes efetivamente locais, está em
> [CONTINUAR_LOCAL.md](CONTINUAR_LOCAL.md) e [VALIDACAO_LOCAL.md](VALIDACAO_LOCAL.md).

**A — Resumo executivo.** A base foi migrada para backend Java 21/Spring Boot e frontend TypeScript/JavaScript separados. O template original foi preservado, e uma cópia preenchida registra decisões e pendências. A etapa de desenvolvimento na nuvem foi executada e testada. SSD, recursos hospedados e entregas reais permanecem separados desse resultado.

**B — Estado real.** Checkout `/workspace/facul-auto`, branch `work`, sem commits; nenhum SHA inventado. O destino `/run/media/kali/Extreme SSD/04-dev/auto-faculdade` não está montado nesta máquina. O protótipo anterior foi preservado em ZIP e sua documentação em `docs/archive/`. O token anexo é do Canvas e não fornece acesso administrativo Supabase/Netlify.

**C — Arquitetura e dependências.** `frontend/` usa React, Vite e TypeScript; `backend/` é monólito modular Java 21/Spring Boot 3.5.16 com módulos de API, autenticação, Canvas e configuração. Supabase fornece Auth/PostgreSQL/RLS. Netlify publica somente o frontend; o backend demanda host JVM/container separado. Node24.22.1/npm11.9.0, Temurin21.0.13+9, Maven3.9.11, bibliotecas e imagens Docker estão fixados pelos mecanismos documentados.

**D — Agentes.** `/root` integrou o projeto; `/root/api_canvas` implementou Java; `/root/interface` adaptou a interface e origem da API; `/root/java_toolchain` instalou ferramentas verificadas; `/root/delivery_ci` preservou/preencheu o template e atualizou configuração/documentação; `/root/independent_review` revisou sem escrever. Nomes de skills indisponíveis não foram simulados como executados.

**E — Mudanças e finalidade.** A separação elimina a API Node/TypeScript ativa e mantém o contrato HTTP utilizado pela interface. O proxy de desenvolvimento encaminha `/api` para Java8080. Frontend publicado usa uma origem HTTPS explícita, sem redirecionar credenciais. O startup conjunto e isolado compartilha carregamento de ambiente/TLS. O instalador local trata caminhos com espaços e recusa sobrescrita. CI/CD anterior foi arquivado porque o novo template o colocou fora do escopo.

**F — Riscos e tratamento.** Dois problemas de startup/proxy foram reproduzidos e corrigidos, com revisão posterior. Permanecem bloqueios externos: SSD inacessível, ausência de sessões administrativas e host JVM não escolhido. “Certificado no banco”, provedor de IA e artefatos Poliweek estão indefinidos. As entregas exigem confirmação; resultado incerto exige verificar recibo antes de nova tentativa. Dados locais inválidos ficam preservados para recuperação.

**G — QA.** Instalação congelada, tipos, frontend build, empacotamento Netlify estático e Maven strict-checksums passaram. Foram executados 45 testes Java, 6 de navegador e 12 verificações Java/Supabase local, todos concluídos com sucesso; nenhum teste Java falhou ou foi ignorado. A auditoria npm de produção reportou zero vulnerabilidades. Os 13 cenários SQL anteriores são históricos e não foram somados como execução nova. Docker build, Canvas real e serviços hospedados não foram testados nesta revisão. Detalhes e falhas resolvidas em `VALIDACAO.md`.

**H — Modificações e recursos.** Arquivos de aplicação, workspace, scripts e documentos foram reorganizados no checkout; a base anterior foi preservada. Serviços Supabase locais já existentes foram reutilizados. Usuários de integração descartáveis foram removidos. A configuração draft recebeu instalação/startup Java e requisitos sem valores. Não houve commit, push, criação de recurso hospedado, publicação de site ou entrega acadêmica.

**I — Pendências.** Disponibilizar a tarefa localmente no SSD ou executar o instalador no computador; fornecer autenticação administrativa pelos ajustes seguros para os serviços solicitados; escolher projeto/site/host JVM; confirmar origem Canvas; definir a senha pessoal no fluxo seguro; esclarecer certificado, IA e atividades/relatórios de teste. Não enviar valores de tokens ou senha pelo chat.

**J — GO/NO-GO.** GO para desenvolvimento/testes da base nesta nuvem e uso do pacote fonte. BLOQUEADO para afirmar instalação no SSD ou provisionamento remoto. NÃO EXECUTADO para publicação, push e entrega real. CI/CD está fora do escopo desta revisão. Não se presume restauração em uma nova tarefa nem snapshot publicado.

**K — Próximos passos.** Revisar o template preenchido, usar o pacote no destino local pelo `scripts/install-local.sh` e iniciar com `npm ci`/`npm run dev`. Nos ajustes do ambiente, os requisitos de acesso a `api.supabase.com` e `api.netlify.com` estão preparados para valores seguros. Depois de os destinos e a autenticação estarem disponíveis, continuar o provisionamento e testar leitura Canvas antes de qualquer entrega específica. Revisar/salvar os ajustes e publicar o ambiente preserva a preparação pelo fluxo do produto; esta execução não fez essa publicação.
