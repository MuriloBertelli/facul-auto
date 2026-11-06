# Contexto preservado — CampusFlow

## Atualização mais recente: trabalhos automáticos

Em 05/11/2026 foi implementada e aplicada a sincronização automática Canvas
para Meus trabalhos, com separação de entregas em grupo e individuais,
preservação de notas/links e 82 atividades reais sincronizadas. A validação
atual é 52 testes Java e nove testes frontend/E2E, além de SQL/RLS isolado.
O frontend foi atualizado manualmente. Consulte
[SINCRONIZACAO_CANVAS.md](SINCRONIZACAO_CANVAS.md) antes do histórico abaixo.

## Estado local mais recente — 05/11/2026

O SSD está acessível e o projeto está instalado em
`/run/media/kali/Extreme SSD/04-dev/auto-faculdade/campusflow`. Consulte
[CONTINUAR_LOCAL.md](CONTINUAR_LOCAL.md) e [VALIDACAO_LOCAL.md](VALIDACAO_LOCAL.md)
antes de usar o histórico abaixo. Supabase CampusFlow `sbdpgdmjtksmshurpywm`
foi criado/configurado, com RLS, signup desabilitado e conta proprietária.
O frontend foi publicado manualmente em
`https://campusflow-murilobertelli.netlify.app`; o backend está local.
O token Canvas foi salvo somente no ambiente privado do backend. A origem
institucional foi verificada em fonte oficial e consultas de leitura retornaram
HTTP 200. Envios continuam desabilitados. Nenhum commit/push ou CI/CD.

## Fonte atual

O usuário forneceu novamente o template editado, agora preservado byte a byte em `templates/TEMPLATE_MESTRE_ORIGINAL.md`. A versão preenchida antes da implementação desta revisão é `templates/TEMPLATE_MESTRE_CAMPUSFLOW.md`. O texto perdido anterior não foi recuperado; este registro usa somente o material efetivamente recebido e o pedido atual.

O projeto se chama **CampusFlow**. O repositório permanece `MuriloBertelli/facul-auto`. O pedido atual exige **backend Java 21/Spring Boot**, frontend TypeScript/JavaScript e pastas `backend/` e `frontend/` separadas. O diretório final desejado no computador é `/run/media/kali/Extreme SSD/04-dev/auto-faculdade`, que não está montado nesta nuvem.

## Objetivo do usuário

Acompanhar tarefas e atrasos do Canvas da PUCPR, reduzir o esforço diário entre trabalho e faculdade, armazenar dados no Supabase e preparar entregas. O template inclui leitura/análise por IA e um teste inicial com relatórios Poliweek. Essas capacidades não podem ser declaradas concluídas sem provedor/modelo, atividades, artefatos e operações reais verificadas.

O usuário quer que o agente configure os serviços, com login único na conta `mrlbertelli@gmail.com`; a senha será definida somente pelo usuário. A configuração remota depende de autenticação administrativa no Supabase/Netlify, e o token Canvas anexado não substitui esse acesso. O significado de “certificado no banco” ainda não está tecnicamente definido.

## Decisões vigentes

| Requisito | Decisão |
|---|---|
| Backend | Java 21 e Spring Boot em `backend/` |
| Frontend | React/TypeScript/JavaScript em `frontend/`, workspace npm com lockfile raiz |
| Dados e login | Supabase Auth/PostgreSQL, proprietário único, RLS, signup público desabilitado |
| Canvas | Token apenas no backend, sessão validada e confirmação específica para entrega |
| Netlify | Hospedar somente o frontend; Spring Boot precisa de host JVM/container separado |
| API pública | Origem HTTPS real em `VITE_API_BASE_URL`; CORS exato em `APP_ALLOWED_ORIGINS` |
| Versões | Registradas nas dependências, lockfile e POM; sem atualização automática durante setup |
| Agentes | Contratos por pasta e evidências; nenhuma skill não instalada é simulada |
| CI/CD/deploy | Fora do escopo conforme linha específica do template mais recente; workflow anterior arquivado |
| SSD | Preparar transferência; não afirmar cópia para um caminho não acessível |

## Histórico preservado

A primeira base usava React/TypeScript com API em Netlify Functions e propunha GitHub CI/CD. Essa arquitetura foi superada pelo pedido Java e pela exclusão atual de CI/CD/deploy. Workflow e Dependabot anteriores estão em `archive/`; documentação e validações antigas estão em `archive/prototipo-typescript/`.

As contagens e resultados do protótipo anterior continuam registrados como histórico e não comprovam a implementação Java. O relatório atual de evidências fica em `VALIDACAO.md` e deve indicar o que foi realmente executado nesta revisão.

## Pendências externas concretas

- Origem HTTPS Canvas e validação do token somente no destino correto.
- Acesso administrativo Supabase e Netlify, organização/projeto/site de destino e limites de criação.
- Conta proprietária preparada pelo fluxo seguro de definição de senha e UUID verificado.
- Host JVM/container, origem HTTPS da API e origem final do frontend.
- Atividades e arquivos/URLs Poliweek para o teste real, com confirmação de cada operação.
- Provedor/modelo e limites da leitura/análise por IA.
- Montagem/acesso ao SSD para executar a transferência e validar a cópia local.

Nenhum valor de segredo é preservado aqui. Atualizações de requisito devem ser registradas neste arquivo sem exigir que o usuário reescreva horas de contexto.
