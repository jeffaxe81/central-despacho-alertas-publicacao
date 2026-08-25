# Central de Alertas Urbanos

Esta aplicação é um **simulador independente de alertas urbanos**. Ela cria ocorrências integralmente fictícias, com endereço, bairro, severidade, timestamp e uma narrativa contextualizada à categoria escolhida. Cada ocorrência pode ser entregue ao mock interno ou encaminhada à central por uma requisição REST `POST`.

## Operação

O painel disponibiliza seis categorias iniciais: iluminação pública, segurança pública municipal, defesa civil, semáforos, câmeras e botão de perigo. Na tela **Simular alertas**, o botão **Disparar** gera uma ocorrência individual e registra o resultado. A tela **Histórico** preserva endereço, narrativa, payload, tentativas e retorno HTTP para auditoria.

| Tela | Finalidade |
| --- | --- |
| **Visão geral** | Exibe totais e a matriz de sucesso, falha e pendência por categoria na janela móvel de 24 horas. |
| **Simular alertas** | Gera e envia uma ocorrência fictícia por categoria. |
| **Histórico** | Consulta registros de entrega, status, resposta e narrativa. |
| **Integrações** | Configura endpoint, cabeçalhos, token, payload e automação por tipo. |

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

## Qualidade

Execute `pnpm test` para rodar a suíte automatizada e `pnpm check` para validar a tipagem. A suíte cobre a criação de histórico, geração contextualizada, reprodução por semente, validação de cabeçalhos e payloads, tentativas de entrega, mock interno, intervalos de automação e procedimentos de configuração.
