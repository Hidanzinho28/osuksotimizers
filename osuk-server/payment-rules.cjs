'use strict';
const crypto = require('node:crypto');
const products = Object.freeze({ultra:{name:'Ultra Pack',amountCents:3590},valorant:{name:'Valorant Booster',amountCents:2290},completo:{name:'Pack Completo',amountCents:1790}});
class PaymentError extends Error { constructor(status,message) { super(message); this.status = status; } }
function validatePurchase(body,key) {
  if(!body || !Object.hasOwn(products,body.pack) || body.paymentMethod !== 'pix') throw new PaymentError(400,'Escolha um pack válido e pagamento via Pix.');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if(email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PaymentError(400,'Confira o e-mail do seu pedido.');
  if(typeof key !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key)) throw new PaymentError(400,'Recarregue a página para iniciar seu pedido.');
  return {pack:body.pack,email,key,amountCents:products[body.pack].amountCents};
}
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const accessToken = (id,secret) => crypto.createHmac('sha256',secret).update('osuk-order-access:'+id).digest('base64url');
function signatureValid(raw,header,secret) {
  if(!secret || typeof header !== 'string' || !/^sha256=[a-f0-9]{64}$/i.test(header)) return false;
  const expected = crypto.createHmac('sha256',secret).update(raw).digest();
  return crypto.timingSafeEqual(expected,Buffer.from(header.slice(7),'hex'));
}
function amountCents(amount) {
  if(typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > 1000000) return null;
  const cents = Math.round(amount*100);
  return Math.abs(amount*100-cents) < 0.000001 ? cents : null;
}
function validatePayment(data,order) {
  if(!data || typeof data.id !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(data.id) || amountCents(data.amount)!==order.amountCents) throw new PaymentError(502,'Não foi possível validar a cobrança. Entre no Discord antes de tentar novamente.');
  if(data.externalReference != null && data.externalReference !== order.id) throw new PaymentError(502,'A referência da cobrança não corresponde ao pedido.');
  const copyPaste = typeof data.copyPaste==='string' && /^000201[\x20-\x7e]{20,4090}$/.test(data.copyPaste) ? data.copyPaste : null;
  const qrCodeBase64 = typeof data.qrCodeBase64==='string' && /^data:image\/png;base64,[A-Za-z0-9+/=]{20,1000000}$/.test(data.qrCodeBase64) ? data.qrCodeBase64 : null;
  const expires = Date.parse(data.expiresAt || '');
  if(!copyPaste || !Number.isFinite(expires)) throw new PaymentError(502,'A cobrança não retornou um código Pix válido. Entre no Discord para conferir.');
  return {providerId:data.id,pix:{copyPaste,qrCodeBase64,expiresAt:new Date(expires).toISOString()}};
}
function eventStatus(event,data,order) {
  if(!data || typeof data.id!=='string' || !/^[A-Za-z0-9_-]{1,160}$/.test(data.id) || data.type!=='PIX_IN' || data.currency!=='BRL' || data.externalReference!==order.id || amountCents(data.amount)!==order.amountCents || (order.providerId && data.id!==order.providerId)) return null;
  if(event==='payment.paid' && data.status==='COMPLETED') return 'approved';
  if(event==='payment.failed' && data.status==='FAILED') return 'rejected';
  if(event==='payment.pix.expired' && data.status==='CANCELED') return 'cancelled';
  if(['refund.completed','payment.refunded'].includes(event) && data.status==='REVERSED' && data.refund?.status==='COMPLETED') return 'refunded';
  return null;
}
function nextStatus(current,next) { return current==='refunded' || (current==='approved' && next!=='refunded') ? current : next; }
function maskEmail(email) { const [local,domain] = email.split('@'); return local.slice(0,2)+'***@'+domain; }
module.exports={products,PaymentError,validatePurchase,digest,accessToken,signatureValid,validatePayment,eventStatus,nextStatus,maskEmail};
