# Investigação de Login OAuth

## Evidência observada

Na versão publicada, a tela protegida foi carregada corretamente e solicitou autenticação. O retorno relatado pelo usuário foi `{"error":"invalid oauth state"}`, emitido pelo callback do servidor quando o nonce recebido no parâmetro `state` não coincide com o cookie temporário do navegador.

Uma tentativa controlada no navegador de validação alcançou o portal de autenticação com `appId`, `redirectUri` de produção e `state` contendo nonce. A sessão automatizada não concluiu o login e terminou em uma página vazia, portanto a confirmação do callback requer uma sessão de usuário autenticada após a correção.
