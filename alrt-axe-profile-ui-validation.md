# Evidência de interface — aplicação do perfil ALRT → AXE

**Data da validação:** 22 de agosto de 2026  
**Rota de inspeção:** `/configuracoes?profilePreview=alrt-axe`  
**Viewport:** desktop, 1280 × 720 pixels.

| Evidência | Resultado |
| --- | --- |
| Diálogo de configuração | A captura de viewport confirmou que o diálogo da categoria abre sobre a tela de Integrações, sem alteração persistida automática. |
| Clique no perfil | O teste de interface `Home.alrtAxeProfile.test.tsx` clica em **Aplicar ALRT → AXE**. |
| Campos confirmados pelo teste | Endpoint oficial, headers `{}`, Bearer vazio, `X-ALRT-API-Key`, payload `alert.received` e modo MOCK desligado. |
| Segurança | A API key existente não é substituída pelo perfil; o usuário continua responsável por informar a credencial de homologação e salvar a configuração. |

> A inspeção visual confirma a abertura do formulário. Como a seleção de coordenadas ocupa a área superior do diálogo, os campos de integração ficam abaixo da dobra no viewport de 720 pixels; a confirmação detalhada dos valores aplicados foi feita pelo teste de interação executado no mesmo fluxo.
