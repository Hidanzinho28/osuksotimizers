'use strict';
const catalog = require('./fulfillment-catalog.json');
// Chamar SOMENTE depois de autenticar o acesso e verificar o pagamento no servidor.
// Este módulo associa conteúdo a um pedido; não verifica nem aprova pagamentos.
function fulfillmentForVerifiedOrder(order) {
  if (!order || !Object.hasOwn(catalog, order.pack)) throw new Error('Pack inválido.');
  if (order.status !== 'approved') return { files: [], tutorialUrl: null };
  const product = catalog[order.pack];
  return {
    files: [{ name: product.name, url: product.downloadUrl, kind: 'drive-folder' }],
    tutorialUrl: product.tutorialUrl
  };
}
module.exports = { fulfillmentForVerifiedOrder };
