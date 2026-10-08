'use strict';
const crypto=require('node:crypto');
const rules=require('./payment-rules.cjs');
const {fulfillmentForVerifiedOrder}=require('./fulfillment.cjs');
function createService({store=require('./database.cjs'),fetcher=fetch,env=process.env}={}) {
  function configured() {
    if(!env.GOATPAY_API_KEY || !env.DATABASE_URL || !env.GOATPAY_WEBHOOK_SECRET || !env.ORDER_TOKEN_SECRET || env.ORDER_TOKEN_SECRET.length<32) throw new rules.PaymentError(503,'Pagamento ainda não configurado no servidor. Entre no Discord para obter ajuda.');
  }
  async function goat(route,body) {
    const response=await fetcher('https://api.goatpay.com.br/v1'+route,{method:body?'POST':'GET',headers:{'X-API-Key':env.GOATPAY_API_KEY,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
    const value=await response.json();
    if(!response.ok || value.success!==true) throw new rules.PaymentError(502,'Não foi possível preparar o Pix. Se já tentou pagar, confira seu pedido no Discord antes de repetir.');
    return value.data;
  }
  function clientOrder(order) {
    const status=order.status;
    return {orderId:order.id,pack:order.pack,amountCents:order.amountCents,status,emailMasked:rules.maskEmail(order.email),...(status==='pending' && order.pix ? {pix:order.pix}:{}),...fulfillmentForVerifiedOrder(order)};
  }
  async function createOrder(body,key,ip='unknown') {
    configured(); const purchase=rules.validatePurchase(body,key);
    const fingerprint=crypto.createHmac('sha256',env.ORDER_TOKEN_SECRET).update(JSON.stringify([purchase.pack,purchase.email,'pix'])).digest('hex');
    await store.rateLimit('create:'+rules.digest(ip),30,3600);
    const id=crypto.randomUUID(),token=rules.accessToken(id,env.ORDER_TOKEN_SECRET);
    const result=await store.reserve({...purchase,id,fingerprint,accessHash:rules.digest(token),accessExpiresAt:new Date(Date.now()+30*86400000)});
    let order=result.order;
    if(!order || order.fingerprint!==fingerprint) throw new rules.PaymentError(409,'Essa tentativa pertence a outro pedido. Recarregue a página.');
    const accessToken=rules.accessToken(order.id,env.ORDER_TOKEN_SECRET);
    if(rules.digest(accessToken)!==order.accessHash) throw new rules.PaymentError(409,'Esse pedido usa uma configuração anterior. Entre no Discord para recuperar o acesso.');
    if(!result.inserted && order.phase!=='ready') throw new rules.PaymentError(409,'Seu pedido já foi iniciado e precisa ser conferido. Aguarde a confirmação ou entre no Discord; não inicie outra cobrança agora.');
    if(result.inserted) {
      try {
        await store.rateLimit('email:'+rules.digest(purchase.email),10,86400);
        const data=await goat('/payment-pix/create',{amount:order.amountCents/100,description:'OSUK '+rules.products[order.pack].name,externalReference:order.id,coverFee:false,expirationSeconds:1800});
        await store.savePayment(order.id,rules.validatePayment(data,order));
        order=await store.getById(order.id);
      } catch(error) {await store.markUncertain(order.id);throw error;}
    }
    return {accessToken,order:clientOrder(order)};
  }
  async function current(token) {
    configured();
    if(typeof token!=='string' || !/^[A-Za-z0-9_-]{32,256}$/.test(token)) throw new rules.PaymentError(401,'Seu acesso não é válido. Entre no Discord para recuperar o pedido.');
    await store.rateLimit('read:'+rules.digest(token),30,60);
    const order=await store.getByToken(rules.digest(token));
    if(!order) throw new rules.PaymentError(401,'Seu acesso expirou. Entre no Discord para recuperar o pedido.');
    return clientOrder(order);
  }
  async function webhook(raw,signature) {
    configured();
    if(!rules.signatureValid(raw,signature,env.GOATPAY_WEBHOOK_SECRET)) throw new rules.PaymentError(401,'Assinatura inválida.');
    let event;try {event=JSON.parse(raw.toString('utf8'));} catch {throw new rules.PaymentError(400,'Notificação inválida.');}
    if(!event || typeof event!=='object') throw new rules.PaymentError(400,'Notificação inválida.');
    if(event.event==='webhook.test') return {ok:true};
    if(!['payment.paid','payment.failed','payment.pix.expired','refund.completed','payment.refunded'].includes(event.event)) return {ok:true};
    if(typeof event.id!=='string' || !/^[A-Za-z0-9_-]{1,160}$/.test(event.id) || !event.data || typeof event.data.externalReference!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(event.data.externalReference)) throw new rules.PaymentError(400,'Notificação sem referência de pedido válida.');
    await store.handleEvent(event);return {ok:true};
  }
  return {createOrder,current,webhook};
}
module.exports={createService};
