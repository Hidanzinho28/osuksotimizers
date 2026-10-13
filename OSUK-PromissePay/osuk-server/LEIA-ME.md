# Servidor privado OSUK

Esta pasta contém o adaptador Pix GoatPay, regras de compra, armazenamento PostgreSQL, validação de webhook e catálogo de entrega. Mantenha-a fora de public e assets. Use repositório privado, pois o catálogo contém os links dos produtos pagos.

O pacote OSUK-Pix-Vercel.zip contém esta pasta na posição correta, junto de api, public, package.json e vercel.json. Siga o README desse pacote ou CONFIGURAR-PIX-NO-NAVEGADOR.md para configurar as contas. Nenhuma credencial está incluída. Os testes executados foram offline, com provedor e armazenamento simulados; banco, chave e entrega real do webhook não foram verificados em produção.

commerce-service.cjs valida o pack e o e-mail, cria o Pix com preço do servidor e fornece token privado de acesso por 30 dias. database.cjs cria o esquema e persiste pedidos/eventos; não usa arquivos locais como banco. payment-rules.cjs valida assinatura, valor, referência, moeda, identidade e estado da cobrança. fulfillment.cjs libera somente o catálogo do produto aprovado.

O e-mail identifica o pedido. Não há serviço de envio ou recuperação por e-mail integrado. A entrega ocorre no chat. Links comuns de YouTube/Drive podem ser compartilhados depois de recebidos; esconder o link após reembolso não revoga um link já copiado no provedor. As permissões das pastas e dos vídeos precisam ser conferidas pelo responsável.
