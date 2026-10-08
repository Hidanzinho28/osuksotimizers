'use strict';
// As cobranças são persistidas e consultadas na GoatPay. Nenhum pedido fica em memória local.
const crypto=require('node:crypto'),rules=require('./payment-rules.cjs');
const {fulfillmentForVerifiedOrder}=require('./fulfillment.cjs');
const statuses={PENDING:'pending',PROCESSING:'pending',COMPLETED:'approved',FAILED:'rejected',CANCELED:'cancelled',REVERSED:'refunded'};
function createService({env=process.env,fetcher=fetch,clock=Date.now,qrCode}={}) {
  function key(){const value=env.GOATPAY_API_KEY?.trim();if(!value)throw new rules.PaymentError(503,'Pagamento em configuração. Entre no Discord para obter ajuda.');return value;}
  function secret(){return crypto.createHmac('sha256',key()).update('OSUK encrypted order receipt v1').digest();}
  function reference(p){return 'osuk_'+crypto.createHmac('sha256',secret()).update(JSON.stringify([p.pack,p.email,p.key,p.amountCents])).digest('base64url');}
  function seal(order){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',secret(),iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(order),'utf8'),cipher.final()]);return 'osuk1_'+Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');}
  function open(token){
    key();
    try{
      if(typeof token!=='string'||!/^osuk1_[A-Za-z0-9_-]{80,1500}$/.test(token))throw Error();
      const encoded=token.slice(6),bytes=Buffer.from(encoded,'base64url');if(bytes.toString('base64url')!==encoded)throw Error();
      const decipher=crypto.createDecipheriv('aes-256-gcm',secret(),bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));
      const order=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
      if(order.v!==1||!Object.hasOwn(rules.products,order.pack)||!/^osuk_[A-Za-z0-9_-]{43}$/.test(order.id)||typeof order.email!=='string'||order.email.length>254||!Number.isSafeInteger(order.amountCents)||order.amountCents<100||!Number.isSafeInteger(order.expiresAt)||order.expiresAt<=clock())throw Error();
      return order;
    }catch{throw new rules.PaymentError(401,'Seu acesso expirou ou não é válido. Entre no Discord para recuperar o pedido.');}
  }
  async function goat(route,body){
    let response;try{response=await fetcher('https://api.goatpay.com.br/v1'+route,{method:body?'POST':'GET',headers:{'X-API-Key':key(),Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});}catch{throw new rules.PaymentError(502,'A consulta demorou. Aguarde e confira o pedido antes de gerar outro Pix.');}
    if(!body&&response.status===404)return null;
    if(response.status===429)throw new rules.PaymentError(429,'Aguarde alguns instantes antes de atualizar o pagamento.');
    let value;try{value=await response.json();}catch{throw new rules.PaymentError(502,'Não foi possível consultar o pagamento agora.');}
    if(!response.ok||value?.success!==true||!value.data)throw new rules.PaymentError(502,'Não foi possível consultar o Pix. Confira a configuração da conta ou fale no Discord.');
    return value.data;
  }
  function verify(data,order,created=false){
    const status=statuses[data?.status];
    if(!data||typeof data.id!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(data.id)||!status||typeof data.amount!=='number'||!Number.isFinite(data.amount)||Math.abs(data.amount*100-order.amountCents)>0.000001)throw new rules.PaymentError(502,'Não foi possível validar o valor e o status do pedido.');
    if(created){if(status!=='pending'||(data.externalReference!=null&&data.externalReference!==order.id))throw new rules.PaymentError(502,'A nova cobrança retornou dados inesperados. Atualize o pedido.');}
    else if(data.externalReference!==order.id||data.type!=='PIX_IN'||data.currency!=='BRL')throw new rules.PaymentError(502,'A cobrança não corresponde ao pedido.');
    return status;
  }
  async function clientOrder(order,data,created=false){
    const status=data?verify(data,order,created):'pending';let pix;
    if(data&&status==='pending'){
      pix=rules.validatePayment(data,order).pix;
      if(!pix.qrCodeBase64){const encoder=qrCode||require('qrcode');pix.qrCodeBase64=await encoder.toDataURL(pix.copyPaste,{errorCorrectionLevel:'M',margin:4,width:320,color:{dark:'#000000ff',light:'#ffffffff'}});}
    }
    return{orderId:order.id,pack:order.pack,amountCents:order.amountCents,status,emailMasked:rules.maskEmail(order.email),lookupPending:!data,...(pix?{pix}:{}),...fulfillmentForVerifiedOrder({...order,status})};
  }
  async function prepare(body,idempotencyKey){
    key();const p=rules.validatePurchase(body,idempotencyKey),order={v:1,id:reference(p),pack:p.pack,email:p.email,amountCents:p.amountCents,expiresAt:clock()+30*86400000};
    return{accessToken:seal(order),order:await clientOrder(order,null)};
  }
  async function createOrder(body,idempotencyKey,ip,token){
    key();const p=rules.validatePurchase(body,idempotencyKey),prepared=token?null:await prepare(body,idempotencyKey),accessToken=token||prepared.accessToken,order=open(accessToken);
    if(order.id!==reference(p)||order.pack!==p.pack||order.email!==p.email||order.amountCents!==p.amountCents)throw new rules.PaymentError(409,'O acesso não corresponde à compra escolhida. Reabra o pagamento.');
    const existing=await goat('/payment-pix/get/'+encodeURIComponent(order.id));
    if(existing)return{accessToken,order:await clientOrder(order,existing)};
    if(body.recoverOnly===true)throw new rules.PaymentError(409,'A tentativa anterior precisa ser conferida. Aguarde e atualize o pedido ou fale no Discord antes de gerar outro Pix.');
    const data=await goat('/payment-pix/create',{amount:order.amountCents/100,description:'OSUK '+rules.products[order.pack].name,externalReference:order.id,coverFee:false,expirationSeconds:1800});
    return{accessToken,order:await clientOrder(order,data,true)};
  }
  async function current(token){const order=open(token);return clientOrder(order,await goat('/payment-pix/get/'+encodeURIComponent(order.id)));}
  return{prepare,createOrder,current};
}
const isKeyOnlyToken=value=>typeof value==='string'&&value.startsWith('osuk1_')&&value.length>100;
module.exports={createService,isKeyOnlyToken};
