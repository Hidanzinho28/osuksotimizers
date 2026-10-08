# OSUK — Pix com apenas uma chave

Esta versão precisa apenas de **GOATPAY_API_KEY** na Vercel. Cria o Pix, exibe QR Code e código copia e cola, consulta o pagamento na GoatPay e libera tutorial e download no chat após a confirmação. Não precisa criar banco ou webhook para o modo novo. A integração anterior permanece disponível para quem já a usa.

## 1. Atualize o GitHub

Extraia **OSUK-uma-chave.zip**. Envie o conteúdo de `osuk-vercel` para a raiz do repositório conectado à Vercel, substituindo os arquivos anteriores. Preserve esta estrutura:

```text
public/
api/
osuk-server/
package.json
package-lock.json
vercel.json
.gitignore
.env.example
README.md
```

Não envie somente o ZIP, uma pasta adicional envolvendo tudo, `node_modules` ou `.env` com credenciais. Use um repositório privado: o catálogo do servidor contém links de entrega. Nunca coloque `osuk-server` dentro de `public`.

Na Vercel: **Framework Preset: Other**, **Root Directory: raiz do repositório**, **Output Directory: public**, **Build Command: vazio**. Deixe a instalação padrão das dependências habilitada. As APIs já estão incluídas na configuração.

## 2. Cadastre uma variável

No seu navegador habitual: Vercel → projeto → **Settings → Environment Variables**:

| Nome | Valor | Ambiente |
| --- | --- | --- |
| `GOATPAY_API_KEY` | Sua chave privada da conta GoatPay | Production |

Obtenha a chave no painel do provedor. Deve permitir criar e consultar cobranças Pix. Não envie no chat, no GitHub ou no JavaScript público. `.env.example` contém apenas o nome vazio.

## 3. Faça um novo deploy

Salve e abra **Deployments → Redeploy**. Depois, abra a página de pagamento. Novas variáveis passam a valer no próximo deploy.

`/api/health` informa se a configuração está presente. Isso não comprova validade da chave ou permissão da conta. `mode: api_confirmation` identifica o modo de uma chave. O domínio de produção é obtido automaticamente da Vercel.

## Fluxo e funcionamento

Escolher pack → confirmar e-mail → **Gerar QR Code Pix** → pagar → confirmação consultada no servidor → foguete → **Acessar pack** → chat com tutorial e download.

Preços fixados no servidor: Ultra R$ 35,90; Valorant R$ 22,90; Completo R$ 17,90. O QR é gerado do código Pix real retornado pela GoatPay. Não é uma chave aleatória inventada. Referência, valor, moeda, tipo e status são verificados antes da entrega. Reembolso confirmado bloqueia novas consultas aos links.

Consulta automática a cada 15 segundos por até 10 minutos; depois use Atualizar pagamento. Pix vence em 30 minutos. Acesso dura 30 dias e fica nesta sessão da aba. A cobrança é consultada no provedor inclusive após reiniciar o servidor. Preserve a chave: trocá-la invalida os recibos criptografados deste modo; pedidos antigos precisarão de suporte.

O e-mail identifica a compra. **Não existe envio ou recuperação por e-mail integrado**; a entrega ocorre no chat. Perder o acesso ou fechar a sessão pode exigir suporte no Discord. Links de YouTube/Drive recebidos podem ser compartilhados; não são downloads com autenticação própria.

## Erros comuns

| Sinal | O que conferir |
| --- | --- |
| Pagamento em configuração | Nome exato da variável, Production e novo deploy |
| API retorna 404 | Pasta api na raiz e Root Directory |
| Pix não é gerado | Validade/permissões da chave, condições da conta e logs da Vercel |
| Tentativa anterior precisa ser conferida | Aguarde, atualize e confira no painel/Discord antes de iniciar outro pedido |
| Pagou e não liberou | Atualize e confira referência e status da cobrança no painel |

O navegador salva um recibo criptografado antes de solicitar o Pix. Repetir a tentativa consulta a cobrança existente; após resultado incerto não cria outra automaticamente. Isso não garante idempotência global para solicitações simultâneas feitas fora do fluxo do site. Este modo não possui limitador distribuído; configure limites e monitoramento da conta conforme o volume.

**Instalações anteriores:** se DATABASE_URL, GOATPAY_WEBHOOK_SECRET e ORDER_TOKEN_SECRET já estiverem completamente configurados, novas compras continuam no modo antigo. Preserve essas variáveis e o banco para recuperar acessos antigos. Tokens novos osuk1_ continuam consultados no provedor, inclusive numa instalação com banco.

Testes locais usaram respostas simuladas, sem cobranças. Foram verificados QR, recuperação após reinício, repetição, acesso adulterado, preço/referência/moeda, aprovação e reembolso. A ativação real depende de cadastrar a chave e publicar esta versão. Uma compra real de verificação pode gerar cobrança e tarifa.

## Documentação oficial

- [Criar Pix](https://docs.goatpay.com.br/api-reference/endpoint/payment-pix/create)
- [Consultar cobrança](https://docs.goatpay.com.br/api-reference/endpoint/payment-pix/get)
- [Variáveis Vercel](https://vercel.com/docs/environment-variables)
- [Funções Vercel](https://vercel.com/docs/functions/runtimes/node-js)
