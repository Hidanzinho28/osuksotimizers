/* Catálogo público e contrato do frontend. Preço e pagamento devem ser validados no servidor. */
(() => {
  'use strict';
  const catalog = Object.freeze({
    ultra: Object.freeze({ name: 'Ultra Pack', cents: 3590, page: 'ultra-pack.html', description: 'Windows, resposta e jogos em um pack. Tutorial passo a passo incluído.' }),
    valorant: Object.freeze({ name: 'Valorant Booster', cents: 2290, page: 'valorant-booster.html', description: 'Ajustes focados em Valorant. Tutorial passo a passo incluído.' }),
    completo: Object.freeze({ name: 'Pack Completo', cents: 1790, page: 'pack-completo.html', description: 'Ajustes para o Windows e uso geral. Tutorial passo a passo incluído.' })
  });
  function packId(value) { return Object.hasOwn(catalog, value) ? value : 'ultra'; }
  function money(cents) { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function quote(id, offer = {}, now = Date.now()) {
    id = packId(id);
    const product = catalog[id], regular = offer.regularPricesCents?.[id];
    const valid = Number.isSafeInteger(regular) && regular > product.cents;
    const start = Date.parse(offer.startsAt || '');
    const active = Number.isFinite(start) && now >= start && now < start + 10800000;
    const demo = offer.demo === true;
    return { ...product, id, cents: valid && !demo && Number.isFinite(start) && !active ? regular : product.cents,
      regularCents: valid && (demo || active) ? regular : null,
      savingCents: valid && (demo || active) ? regular - product.cents : 0, demo };
  }
  function https(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url : null; } catch { return null; }
  }
  function apiBase(value, locationOrigin) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, locationOrigin);
      if (url.username || url.password || url.search || url.hash) return null;
      if (url.origin !== locationOrigin && url.protocol !== 'https:') return null;
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      return url.href.replace(/\/$/, '');
    } catch { return null; }
  }
  function checkoutUrl(value, origins) {
    const url = https(value);
    return url && Array.isArray(origins) && origins.includes(url.origin) ? url.href : null;
  }
  function token(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{32,1536}$/.test(value) ? value : null; }
  function pix(value) {
    if (!value || typeof value.copyPaste !== 'string' || !/^000201[\x20-\x7e]{20,4090}$/.test(value.copyPaste) || !Number.isFinite(Date.parse(value.expiresAt || ''))) return null;
    return { copyPaste:value.copyPaste, expiresAt:value.expiresAt,
      qrCodeBase64:typeof value.qrCodeBase64 === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]{20,1000000}$/.test(value.qrCodeBase64) ? value.qrCodeBase64 : null };
  }
  function order(value) {
    if (!value || !['pending','approved','rejected','cancelled','refunded'].includes(value.status)) throw Error('Resposta de pedido inválida.');
    if (!Object.hasOwn(catalog, value.pack) || !Number.isSafeInteger(value.amountCents) || value.amountCents < 0) throw Error('Resumo do pedido inválido.');
    return { ...value, pix:value.status === 'pending' ? pix(value.pix) : null, tutorialUrl: value.status === 'approved' && https(value.tutorialUrl) ? value.tutorialUrl : null,
      files: value.status === 'approved' && Array.isArray(value.files) ? value.files.slice(0, 30) : [],
      tutorial: value.status === 'approved' && Array.isArray(value.tutorial) ? value.tutorial.slice(0, 30) : [] };
  }
  const responses = {
    payment: 'A liberação acontece quando o provedor confirma o pagamento. Voltar do checkout, sozinho, não confirma a compra. Use “Atualizar pedido” para consultar o status.',
    files: 'Após a confirmação, use “Baixar pack” nesta conversa para abrir os arquivos do seu produto. Na prévia, os cartões são exemplos e não permitem baixar um pack.',
    tutorial: 'Após a confirmação, use “Assistir tutorial” nesta conversa para abrir o vídeo passo a passo do seu pack. Leia os requisitos e siga a ordem indicada. Se precisar de ajuda com seu PC, fale com a OSUK no Discord.',
    email: 'Confira o e-mail informado na página de pagamento. Ele identifica sua compra e será usado para o acesso à entrega quando a integração estiver ativa. Nunca envie senha ou código de acesso aqui.',
    support: 'Para dúvidas específicas do seu setup, entre no Discord da OSUK pelo botão de suporte. Esta conversa responde automaticamente a dúvidas sobre compra e acesso.'
  };
  function reply(question) {
    const text = String(question).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/email|e-mail|correio/.test(text)) return responses.email;
    if (/pix|pag|boleto|cartao|status|demora/.test(text)) return responses.payment;
    if (/baix|download|arquivo|receb|zip/.test(text)) return responses.files;
    if (/tutorial|passo|aplic|instal|revert|config/.test(text)) return responses.tutorial;
    return responses.support;
  }
  const core = Object.freeze({ catalog, packId, money, quote, https, apiBase, checkoutUrl, token, pix, order, reply });
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  else window.OSUK_COMMERCE = core;
})();
