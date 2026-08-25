# Validação da Autenticação Local

| Verificação | Resultado |
| --- | --- |
| Tela pública de login | Aprovada. Exibe e-mail, senha e chamada clara para abrir o painel. |
| Alternância para cadastro | Aprovada. Exibe nome, e-mail, senha e confirmação de senha sem quebrar o layout do console operacional. |
| Responsividade desktop | Aprovada. A composição preserva o tema escuro, a hierarquia e a legibilidade do produto. |

O envio de dados não foi realizado no navegador durante a inspeção visual para evitar a criação de uma conta de teste persistente. Os fluxos de registro, login válido e login inválido são cobertos por testes automatizados do servidor.

A validação no navegador também confirmou que senhas divergentes exibem uma mensagem clara e impedem o envio do formulário, sem criar uma conta ou chamar o servidor.

Os testes automatizados cobrem hash de senha, cadastro, login válido, login inválido, logout, bloqueio de procedimento protegido sem sessão e acesso ao mesmo procedimento com sessão de uma conta local. A suíte atual executou 57 testes aprovados e 1 teste de integração explicitamente ignorado.

A versão publicada em `https://central-aler-hzdtze6w.manus.space` foi verificada após a atualização e apresenta a tela pública de **Entrar** e **Criar conta**, com os campos de e-mail e senha e sem direcionamento ao provedor OAuth.
