# Central de Alertas Urbanos

Esta aplicação é um **simulador independente de alertas urbanos**. Ela cria ocorrências integralmente fictícias, com endereço, bairro, severidade, timestamp e uma narrativa contextualizada à categoria escolhida. Cada ocorrência pode ser entregue ao mock interno ou encaminhada à central por uma requisição REST `POST`.

## Operação

O painel disponibiliza seis categorias iniciais: iluminação pública, segurança pública municipal, defesa civil, semáforos, câmeras e botão de perigo. Na tela **Simular alertas**, o botão **Disparar** gera uma ocorrência individual e registra o resultado. A tela **Histórico** preserva endereço, narrativa, payload, tentativas e retorno HTTP para auditoria.

| Tela                | Finalidade                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| **Visão geral**     | Exibe totais e a matriz de sucesso, falha e pendência por categoria na janela móvel de 24 horas. |
| **Simular alertas** | Gera e envia uma ocorrência fictícia por categoria.                                              |
| **Histórico**       | Consulta registros de entrega, status, resposta e narrativa.                                     |
| **Integrações**     | Configura endpoint, cabeçalhos, token, payload e automação por tipo.                             |

## Modo teste e integração REST

Por padrão, todos os tipos usam o **modo teste**. Nesse estado, o destino real salvo é ignorado e a entrega é processada pelo mock interno, que responde com `202` e grava o recebimento. Assim, é possível validar geração, payload e histórico sem conectar-se à central real.

Para apontar uma central real, abra **Configurar**, desligue o modo teste, informe um endpoint público HTTP ou HTTPS e salve. O modelo de payload precisa ser um objeto JSON e aceita `{{alertId}}`, `{{category}}`, `{{eventName}}`, `{{severity}}`, `{{timestamp}}`, `{{address}}`, `{{neighborhood}}` e `{{narrative}}`. Cabeçalhos personalizados também são definidos em JSON. Um token informado é enviado como `Authorization: Bearer <token>` e não retorna ao navegador após salvo.

> O despachante realiza até três tentativas para falhas de rede e respostas HTTP 5xx. Respostas 4xx são registradas como falhas de negócio, sem repetição automática.

## Coordenadas pelo mapa

No **Simulador de eventos**, selecione diretamente no mapa a posição do próximo alerta antes de escolher a categoria e disparar. O botão **Usar sugestão** restaura o ponto inicial de teste. Quando o mapa interativo estiver disponível, o operador pode clicar no mapa ou arrastar o marcador; no modo de fallback, o mapa estático continua clicável e oferece campos numéricos para precisão. A tela **Configurar** também permite salvar uma coordenada padrão por categoria.

As chaves `latitude`, `longitude` e `coordinates` são acrescentadas ao payload de saída mesmo que o modelo JSON tenha sido personalizado. A narrativa e o histórico também registram a referência geográfica, permitindo que a central de despacho relacione a ocorrência ao ponto selecionado.

## Automação e rastreabilidade

Cada categoria pode ser ativada para envio periódico nos intervalos de 5, 10, 15, 20, 30, 60, 120, 180, 360, 720 ou 1440 minutos. Depois de salvar um checkpoint e publicar o projeto, os disparos ocorrem pelo servidor; o navegador não precisa permanecer aberto.

Cada alerta armazena uma semente de simulação. A mesma categoria, severidade, semente e timestamp reproduzem exatamente o mesmo endereço e narrativa, o que permite testar e auditar cenários de forma consistente.

## Contrato canônico v1

O primeiro contrato interno do Motor Universal de Eventos está em `shared/events/canonicalEvent.ts`. Ele usa o envelope CloudEvents 1.0 com extensões Axesistemas obrigatórias para execução, cenário, versão, semente e sequência.

O contrato canônico permanece restrito a eventos sintéticos (`axessimulated: true`). O fluxo produtivo, o barramento e a entrega real ALRT → AXE continuam preservados enquanto a migração é validada por microentregas.

O adaptador puro `shared/connectors/alrtAxeAdapter.ts` converte um evento canônico para o envelope ALRT → AXE homologado. Ele valida os dados necessários, rejeita entradas incompletas e não realiza chamadas de rede. O fluxo de entrega real ainda não depende automaticamente desse adaptador.

Na MUE-003, o modo teste ALRT → AXE passou a executar uma validação **shadow** no mock interno. O mock reconhecia o envelope legado `alert.received`, reconstruía um evento canônico sintético equivalente, projetava-o novamente por `toAlrtAxeEvent` e comparava a saída com o payload legado.

Na MUE-004, o próprio `dispatchConfiguredAlert()` passou a construir o evento canônico antes da fronteira do mock quando o conector ALRT → AXE está em modo teste. O evento canônico e o payload legado são enviados em paralelo ao mock, e o adaptador confirma que a projeção canônica continua equivalente ao contrato legado.

Na MUE-005, o fallback de reconstrução do evento canônico a partir do payload legado foi removido do mock. A comparação shadow agora ocorre somente quando `canonicalEvent` é recebido explicitamente do dispatcher. Se o mock receber apenas o payload legado, continua respondendo `202`, mas não expõe `compatibility`. Se receber um canônico explícito inválido, mantém o comportamento não bloqueante e retorna `compatibility.equivalent: false`.

Na MUE-006, o caminho ALRT → AXE em modo teste passou a registrar uma observação estruturada do canônico explícito com o evento `eventbus.canonical_shadow_observed`. O registro contém identificadores de correlação e evento, tipo canônico, indicação de simulação e resultado da equivalência com o legado. Essa observabilidade é isolada no caminho shadow: não cria segunda publicação, não grava um segundo registro de outbox e não altera os payloads entregues por webhook ou SSE.

Na MUE-007, foi criado o canal interno `server/eventBus/canonicalShadow.ts`, exclusivo do caminho de teste. O mock passou a publicar nele o mesmo objeto `canonicalEvent` explícito recebido do dispatcher, junto com o resultado `equivalent` já calculado. O canal opera somente em memória, suporta assinantes internos e isola falhas de assinantes; ele não grava outbox, não chama HTTP e não entrega eventos por webhook ou SSE.

Na MUE-008, a origem dessa publicação shadow foi movida do mock para `dispatchConfiguredAlert()`. O mock permanece responsável por validar o canônico contra o payload legado e devolver `compatibility`; depois dessa validação, o dispatcher publica no canal interno o mesmo `canonicalEvent` e o mesmo resultado `equivalent`. Assim, o mock deixa de ser origem de eventos shadow e permanece apenas como receptor/validador, sem alteração de `publishEvent()`, outbox, webhook ou SSE.

A entrega real permanece inalterada: fora do modo teste, o dispatcher continua usando o payload legado, sem publicação canônica adicional e sem mudança no HTTP, autenticação, retries, barramento ou persistência.

## Qualidade

Execute `pnpm test` para rodar a suíte automatizada e `pnpm check` para validar a tipagem. A suíte cobre a criação de histórico, geração contextualizada, reprodução por semente, contrato canônico v1, adaptador ALRT → AXE, shadow de compatibilidade no mock, geração canônica antes da fronteira do mock, exigência de canônico explícito para comparação shadow, observabilidade estruturada do canônico em modo teste, transporte pelo canal shadow interno, publicação shadow originada no dispatcher, isolamento de falhas de assinantes, validação de cabeçalhos e payloads, tentativas de entrega, intervalos de automação e procedimentos de configuração.
