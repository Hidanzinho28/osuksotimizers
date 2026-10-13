# OSUK — Pix com PromissePay

Este pacote completo mantém o site e a entrega em chat. Novas compras usam PromissePay. As integrações antigas foram mantidas para consultas de pedidos anteriores; preserve as credenciais antigas se houver compradores com esses acessos.

## Publicar

1. Extraia OSUK-PromissePay.zip. Envie TODO o conteúdo da pasta OSUK-PromissePay para a raiz de um repositório privado no GitHub. Não envie apenas o ZIP nem uma pasta adicional envolvendo os arquivos.
2. Na Vercel: Framework Preset Other, Root Directory raiz, Output Directory public, Build Command vazio. Mantenha a instalação padrão de dependências.
3. Em Settings → Environment Variables → Production, cadastre **PROMISSEPAY_API_KEY** com a chave da PromissePay. Não cadastre em public/config.js nem no GitHub. Nenhuma chave real está neste pacote.
4. Na PromissePay → Integrações → Credenciais, a chave precisa de **payments.create** e **payments.read**. Saques não são utilizados por esta integração.
5. Salve e faça Redeploy. Abra /api/health: provider deve ser PromissePay. configuration_present significa apenas que a variável foi preenchida; não comprova validade da chave.

Estrutura para upload: public/, api/, osuk-server/, package.json, package-lock.json, vercel.json, .gitignore, .env.example e README.md. Não envie node_modules nem .env com segredo. O catálogo privado contém links de entrega, por isso o repositório deve ser privado.

## Como funciona

Escolha o pack → confirme o e-mail → gere QR Code/copia e cola → pague → clique em Atualizar pagamento ou aguarde a reconciliação → Acessar pack → chat com tutorial e download.

Valores em CENTAVOS: Ultra 3590 (R$ 35,90), Valorant 2290 (R$ 22,90), Completo 1790 (R$ 17,90). O servidor usa Authorization com a chave crua, sem Bearer, em https://api.promisse.com.br. Primeiro POST /transactions; depois GET /transactions/{id}. Apenas status PAID/paid, com ID e valor correspondentes, libera o pack. Tipo diferente de DEPOSIT é recusado quando informado. Se a criação retornar storeId, ele também é conferido nas consultas.

O recibo inicial fica salvo antes de gerar o Pix. Após uma resposta válida, um novo recibo incorpora o ID real do provedor. Repetir esse acesso apenas consulta a cobrança. Se a resposta da criação se perder antes de devolver o ID, o site bloqueia nova criação automática e exige conferência no painel/Discord. Nunca associa compras somente pela coincidência de valor. A API documentada não oferece idempotência na criação; este pacote não promete proteção global contra chamadas simultâneas fora do fluxo do site.

## Confirmação e limites

Para manter apenas UMA variável obrigatória, esta versão usa consulta autenticada. A página aberta reconcilia no máximo a cada 60 segundos por 10 minutos, pausa em segundo plano e oferece Atualizar pagamento. Não usa webhooks nem exige banco para as novas compras. A documentação da PromissePay recomenda webhook para operações com volume maior; será uma etapa adicional, com validação da assinatura e armazenamento persistente dos eventos.

A expiração do Pix vem do provedor, sem prazo inventado. O acesso criptografado dura 30 dias e fica na sessão da aba. Reiniciar o servidor mantém a consulta pelos recibos com ID. Trocar a chave invalida os recibos desse modo. Perder a sessão ou uma resposta incerta exige suporte. Não existe envio ou recuperação por e-mail integrado; o e-mail identifica a compra e o conteúdo é entregue no chat.

Links de Drive/YouTube recebidos podem ser compartilhados; esta integração não transforma esses arquivos em downloads privados com autenticação própria. Reembolsos/MED não têm um fluxo local persistente nesta versão: a entrega depende do estado retornado por GET /transactions/{id}; status desconhecido ou erro bloqueia novas exibições dos links. Não é possível revogar links que o comprador já recebeu.

## Erros

Os logs e o aviso exibem HTTP e código do provedor, sem chave, e-mail, recibo ou corpo bruto. ACCESS_FORBIDDEN: confira a chave e o deploy. FORBIDDEN_SCOPE: confira payments.create/payments.read. IP_NOT_ALLOWED: a restrição de IP da chave precisa ser compatível com a saída do servidor Vercel. KYC_REQUIRED/ACCOUNT_BLOCKED: resolva no painel do provedor. NOT_FOUND: confira a conta e o ID do pedido. TOO_MANY_REQUESTS: aguarde.

GOATPAY_API_KEY e os segredos/banco antigos só continuam necessários para consultar pedidos anteriores. Novas tentativas têm armazenamento separado por provedor. Mantenha também a versão anterior no GitHub para recuperação.

Testes offline cobriram os três preços, autenticação, QR, criação antes da consulta, aprovação, recibos adulterados, valor/ID/tipo/conta divergentes, expiração, reinício e tentativas repetidas. Nenhuma cobrança real foi criada. A ativação real depende de cadastrar a chave, publicar os arquivos e conferir uma compra autorizada; pode haver tarifa do provedor.

Documentação oficial: https://promisse.com.br/docs
