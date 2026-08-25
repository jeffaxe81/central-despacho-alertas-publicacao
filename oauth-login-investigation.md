# Investigação de Login OAuth

## Evidência observada

Na versão publicada, a tela protegida foi carregada corretamente e solicitou autenticação. O retorno relatado pelo usuário foi `{"error":"invalid oauth state"}`, emitido pelo callback do servidor quando o nonce recebido no parâmetro `state` não coincide com o cookie temporário do navegador.

Uma tentativa controlada no navegador de validação alcançou o portal de autenticação com `appId`, `redirectUri` de produção e `state` contendo nonce. A sessão automatizada não concluiu o login e terminou em uma página vazia, portanto a confirmação do callback requer uma sessão de usuário autenticada após a correção.

## Verificação após a correção

Na versão republicada, um nonce temporário foi gravado no cookie `__Host-oauth_state` do domínio de produção com `SameSite=Lax`, e o callback foi acionado com o mesmo nonce no `state`. A resposta foi `{"error":"OAuth callback failed"}` apenas porque o código de autorização utilizado no teste era propositalmente inválido. Como a resposta **não** foi `{"error":"invalid oauth state"}`, o callback aceitou o cookie e validou a correção do mecanismo de estado antes da etapa de troca de credenciais.
