window.OSUK_CONFIG = {
  discord: 'https://discord.gg/X6Vna8y2W2', // Convite da comunidade e suporte.
  contactEmail: '',
  siteUrl: 'https://osukotimizers.vercel.app',
  checkout: { ultra: '', valorant: '', completo: '' }, // URLs HTTPS de checkouts hospedados
  commerce: {
    provider: 'PromissePay',
    apiBase: '/api', // Backend OSUK, ex. /api. Vazio mantém a compra indisponível.
    prepareOrder: true, // Salva o acesso antes de solicitar a cobrança Pix.
    pollIntervalMs: 60000, // Reconciliação limitada enquanto esta aba acompanha o pagamento.
    methods: ['pix'], // Outros meios só após confirmação de disponibilidade no provedor.
    checkoutOrigins: ['https://promisse.com.br'] // Pix é exibido nesta página pelo backend OSUK.
  }, // Credenciais, pedidos, arquivos privados e webhooks pertencem ao servidor.
  analytics: { google: '', tiktok: '' }, // IDs; ativar somente após consentimento
  promotion: {
    demo: true, // Prévia claramente sinalizada; confirmar preços reais antes de ativar.
    startsAt: '', // Promoção real: ISO com fuso, ex. YYYY-MM-DDTHH:mm:ss-03:00; dura 3 horas.
    regularPricesCents: { ultra: 10257, valorant: 3817, completo: 2557 } // EXEMPLOS em centavos, equivalentes a aproximadamente 65%, 40% e 30% OFF.
  },
  campaigns: {
    valorant: { eyebrow: 'SEU SETUP. SEU VALORANT.', subtitle: 'Ajustes focados no seu setup para buscar mais estabilidade nas partidas de Valorant.', recommended: 'valorant' },
    tiktok: { eyebrow: 'DO FEED PARA O SEU SETUP.', subtitle: 'Conheça os packs, entenda os ajustes e escolha o próximo passo para o seu PC.', recommended: 'ultra' }
  }
};
