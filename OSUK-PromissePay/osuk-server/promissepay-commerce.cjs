'use strict';
const crypto = require('node:crypto');
const rules = require('./payment-rules.cjs');
const {fulfillmentForVerifiedOrder} = require('./fulfillment.cjs');
const states = Object.freeze({PENDING:'pending',PAID:'approved',FAILED:'rejected',EXPIRED:'cancelled'});
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
const isPromisseToken = value => typeof value === 'string' && value.startsWith('osukp1_');

function createService({env=process.env,fetcher=fetch,clock=Date.now,qrCode}={}) {
  function apiKey() {
    const key=env.PROMISSEPAY_API_KEY?.trim();
    if(!key) throw new rules.PaymentError(503,'Pagamento em configuração. O responsável precisa cadastrar PROMISSEPAY_API_KEY na Vercel.');
    return key;
  }
  const secret=()=>crypto.createHmac('sha256',apiKey()).update('OSUK PromissePay receipt v1').digest();
  const reference=p=>'osukp_'+crypto.createHmac('sha256',secret()).update(JSON.stringify([p.pack,p.email,p.key,p.amountCents])).digest('base64url');
  function seal(order) {
    const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',secret(),iv);
    const encrypted=Buffer.concat([cipher.update(JSON.stringify(order),'utf8'),cipher.final()]);
    return 'osukp1_'+Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
  }
  function open(token) {
    apiKey();
    try {
      if(typeof token!=='string'||!/^osukp1_[A-Za-z0-9_-]{80,1500}$/.test(token)) throw Error();
      const encoded=token.slice(7),bytes=Buffer.from(encoded,'base64url');
      if(bytes.toString('base64url')!==encoded) throw Error();
      const decipher=crypto.createDecipheriv('aes-256-gcm',secret(),bytes.subarray(0,12));
      decipher.setAuthTag(bytes.subarray(12,28));
      const order=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
      if(order.v!==1||!Object.hasOwn(rules.products,order.pack)||!/^osukp_[A-Za-z0-9_-]{43}$/.test(order.id)||
        typeof order.email!=='string'||order.email.length>254||!Number.isSafeInteger(order.amountCents)||order.amountCents<50||
        !Number.isSafeInteger(order.expiresAt)||order.expiresAt<=clock()||
        (order.providerId!==null&&!validId(order.providerId))||
        (order.providerId!==null&&!Number.isFinite(Date.parse(order.pixExpiresAt||'')))||
        (order.storeId!==null&&!validId(order.storeId))) throw Error();
      return order;
    } catch {
      throw new rules.PaymentError(401,'Seu acesso expirou ou não é válido. Entre no Discord para recuperar o pedido.');
    }
  }
  async function request(route,body) {
    const operation=body?'criar':'consultar';let response;
    try {
      response=await fetcher('https://api.promisse.com.br'+route,{
        method:body?'POST':'GET',redirect:'error',
        headers:{Authorization:apiKey(),Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
        body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)
      });
    } catch {
      console.error('OSUK Pix',JSON.stringify({provider:'PromissePay',operation,code:'NETWORK_OR_TIMEOUT'}));
      throw new rules.PaymentError(502,'A comunicação do Pix demorou ou falhou. Confira seu pedido antes de gerar outro.');
    }
    let data;try {data=await response.json();} catch {
      console.error('OSUK Pix',JSON.stringify({provider:'PromissePay',operation,httpStatus:response.status,code:'INVALID_JSON'}));
      throw new rules.PaymentError(502,`Resposta inválida ao ${operation} Pix (HTTP ${response.status}).`);
    }
    if(!response.ok||!data||typeof data!=='object'||Array.isArray(data)||data.status==='error') {
      const code=typeof data?.code==='string'&&/^[A-Z][A-Z0-9_]{1,79}$/.test(data.code)?data.code:'PROVIDER_ERROR';
      // Metadados somente: sem credenciais, recibos, pagadores ou resposta bruta.
      console.error('OSUK Pix',JSON.stringify({provider:'PromissePay',operation,httpStatus:response.status,code}));
      const hints={ACCESS_FORBIDDEN:'A chave não foi aceita.',IP_NOT_ALLOWED:'O IP do servidor não está autorizado.',
        FORBIDDEN_SCOPE:'A chave precisa das permissões payments.create e payments.read.',
        KYC_REQUIRED:'Conclua a verificação da conta.',ACCOUNT_BLOCKED:'A conta está bloqueada.',
        NOT_FOUND:'Cobrança não encontrada nesta conta.',TOO_MANY_REQUESTS:'Aguarde antes de tentar novamente.',
        BAD_REQUEST:'O provedor recusou os dados da cobrança.'};
      throw new rules.PaymentError(response.status===429?429:502,
        `Falha ao ${operation} Pix (HTTP ${response.status} · ${code}). ${hints[code]||'Confira o pedido no Discord.'}`);
    }
    return data;
  }
  function verify(data,order,created=false) {
    const state=typeof data?.status==='string'?data.status.toUpperCase():'';
    if(!Object.hasOwn(states,state)||!validId(data.id)||!Number.isSafeInteger(data.amount)||data.amount!==order.amountCents||
      (order.providerId!==null&&data.id!==order.providerId)||
      (data.type!=null&&data.type!=='DEPOSIT')||
      (data.currency!=null&&data.currency!=='BRL')||
      (order.storeId!==null&&data.storeId!==order.storeId)||
      (created&&state!=='PENDING')) {
      throw new rules.PaymentError(502,'A cobrança retornou ID, valor, tipo ou status inesperado. Confira o pedido no Discord.');
    }
    // Só IDs recebidos do POST /transactions podem entrar no recibo assinado.
    // A documentação antiga pode omitir type; quando presente precisa ser DEPOSIT.
    return states[state];
  }
  async function clientOrder(order,data,created=false) {
    const status=data?verify(data,order,created):'pending';let pix;
    if(data&&status==='pending') {
      // O validador compartilhado legado espera reais; a API PromissePay usa centavos.
      const payment=rules.validatePayment({...data,amount:data.amount/100,expiresAt:data.expiresAt||data.expirationDate||order.pixExpiresAt},order);
      pix=payment.pix;
      if(!pix.qrCodeBase64) pix.qrCodeBase64=await (qrCode||require('qrcode')).toDataURL(pix.copyPaste,
        {errorCorrectionLevel:'M',margin:4,width:320,color:{dark:'#000000ff',light:'#ffffffff'}});
    }
    return {orderId:order.providerId||order.id,pack:order.pack,amountCents:order.amountCents,status,
      emailMasked:rules.maskEmail(order.email),lookupPending:!data,...(pix?{pix}:{}),
      ...fulfillmentForVerifiedOrder({...order,status})};
  }
  async function prepare(body,idempotencyKey) {
    apiKey();const p=rules.validatePurchase(body,idempotencyKey);
    const order={v:1,id:reference(p),pack:p.pack,email:p.email,amountCents:p.amountCents,
      providerId:null,storeId:null,pixExpiresAt:null,expiresAt:clock()+30*86400000};
    return {accessToken:seal(order),order:await clientOrder(order,null)};
  }
  async function createOrder(body,idempotencyKey,ip,token) {
    apiKey();const p=rules.validatePurchase(body,idempotencyKey);
    const prepared=token?null:await prepare(body,idempotencyKey),accessToken=token||prepared.accessToken;
    const order=open(accessToken);
    if(order.id!==reference(p)||order.pack!==p.pack||order.email!==p.email||order.amountCents!==p.amountCents)
      throw new rules.PaymentError(409,'O acesso não corresponde a esta compra. Reabra o pagamento.');
    if(order.providerId!==null) return {accessToken,order:await current(accessToken)};
    if(body.recoverOnly===true) throw new rules.PaymentError(409,
      'A tentativa anterior precisa ser conferida no painel. Fale no Discord antes de iniciar outra cobrança.');
    // Valor em CENTAVOS. Sem saques, splits ou parâmetros não documentados.
    const data=await request('/transactions',{amount:order.amountCents});
    verify(data,order,true);
    const expiry=Date.parse(data.expiresAt||data.expirationDate||'');
    if(!Number.isFinite(expiry)||(data.storeId!=null&&!validId(data.storeId)))
      throw new rules.PaymentError(502,'O Pix foi solicitado, mas retornou dados incompletos. Confira no Discord antes de gerar outro.');
    const saved={...order,providerId:data.id,storeId:data.storeId||null,pixExpiresAt:new Date(expiry).toISOString()};
    return {accessToken:seal(saved),order:await clientOrder(saved,data,true)};
  }
  async function current(token) {
    const order=open(token);
    if(order.providerId===null) return clientOrder(order,null);
    return clientOrder(order,await request('/transactions/'+encodeURIComponent(order.providerId)));
  }
  return {prepare,createOrder,current};
}
module.exports={createService,isPromisseToken};
