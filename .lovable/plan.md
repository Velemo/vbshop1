# Gestão de utilizadores

- Ativar a aba Utilizadores com foto, nome, email, ID público, saldo e estado da conta, preservando o design.
- Reutilizar os IDs existentes e a atribuição automática: não renumerar contas nem criar tabelas duplicadas.
- Manter pesquisa por nome, email e ID; adicionar nome A–Z/Z–A e maior/menor saldo.
- Ao abrir uma conta, mostrar depósitos resgatados, compras e transferências reais, com datas e valores corretos.
- Permitir banir e desbloquear com confirmação, sem apagar dados nem alterar saldos; impedir o ADM de bloquear a própria conta.
- Validar acesso exclusivo do ADM e testar com a sua sessão, incluindo pesquisa, ordenação e histórico.

## Detalhes técnicos
- Criar as funções de leitura ADM ausentes no Cloud sobre profiles, wallets, recharge_codes, product_mail e vb_transfers, sem executar migrações antigas que criariam tabelas duplicadas.
- Usar a administração segura de autenticação para o bloqueio e aplicar uma verificação de contas bloqueadas antes das operações financeiras, sem modificar as regras dos RPCs existentes.
- O histórico mostra apenas movimentos realmente registados; compras antigas de bilhetes não têm registo financeiro separado e não serão inventadas.