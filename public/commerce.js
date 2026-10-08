(() => {
  'use strict';
  const core = window.OSUK_COMMERCE, config = window.OSUK_CONFIG || {}, settings = config.commerce || {};
  if (!core) return;
  const $ = selector => document.querySelector(selector), query = new URLSearchParams(location.search);
  let id = core.packId(query.get('pack'));
  const base = core.apiBase(settings.apiBase, location.origin), controllers = new Set();
  const allowedOrigins = settings.checkoutOrigins || ['https://pay.goatpay.com.br'];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const say = (element, text) => { if (element) element.textContent = text; };
  const setHidden = (element, hidden) => { if (element) element.hidden = hidden; };
  const preview = ['1','approved'].includes(query.get('preview'));
  let access = core.token(new URLSearchParams(location.hash.slice(1)).get('acesso'));
  if (!access && !preview) { try { access = core.token(sessionStorage.getItem('osuk-delivery-access')); } catch {} }
  if (access && !preview) {
    try { sessionStorage.setItem('osuk-delivery-access', access); } catch {}
    history.replaceState(null, '', location.pathname + location.search);
  }
  let verifiedPaymentOrder = null;
  async function request(route, { method = 'GET', body, accessToken, idempotencyKey } = {}) {
    if (!base) throw Error('Integração em configuração.');
    const controller = new AbortController(); controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), route === '/orders' ? 30000 : 12000);
    try {
      const headers = { Accept: 'application/json' };
      if (body) headers['Content-Type'] = 'application/json';
      if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      const response = await fetch(base + route, { method, headers, body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
      if (!response.ok) {
        let detail; try { detail = await response.json(); } catch {}
        throw Error(typeof detail?.error === 'string' ? detail.error.slice(0,300) : response.status === 401 || response.status === 403 ? 'Seu acesso expirou. Entre no Discord para recuperar o pedido.' : 'Não foi possível consultar o pedido. Tente novamente em instantes.');
      }
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw Error('A consulta demorou mais que o esperado. Tente novamente.');
      throw error;
    } finally { clearTimeout(timeout); controllers.delete(controller); }
  }
  function quote() {
    const product = core.quote(id, config.promotion);
    say($('#order-pack-name'), product.name); say($('#order-pack-description'), product.description);
    say($('#order-price'), core.money(verifiedPaymentOrder?.amountCents ?? product.cents));
    const showOffer = !verifiedPaymentOrder || verifiedPaymentOrder.amountCents === product.cents;
    setHidden($('#order-regular-price'), !showOffer || !product.regularCents); setHidden($('#order-saving'), !showOffer || !product.savingCents);
    say($('#order-regular-price'), product.regularCents ? 'De ' + core.money(product.regularCents) + (product.demo ? ' · exemplo' : '') : '');
    say($('#order-saving'), product.savingCents ? 'Economize ' + core.money(product.savingCents) + (product.demo ? ' · exemplo' : '') : '');
    if ($('#pack-back')) $('#pack-back').href = product.page;
    if ($('#delivery-preview')) {
      $('#delivery-preview').href = 'pagamento.html?pack=' + id + '&preview=approved';
      $('#delivery-preview').textContent = 'Ver prévia da aprovação';
    }
    return product;
  }
  const payment = $('#payment-form');
  if (payment) {
    quote();
    const button = $('#pay-button'), email = $('#buyer-email'), confirmation = $('#buyer-email-confirm');
    const methods = Array.isArray(settings.methods) ? settings.methods.filter(value => ['pix','card','boleto'].includes(value)) : ['pix'];
    payment.querySelectorAll('[name="payment-method"]').forEach(input => { input.disabled = !methods.includes(input.value); });
    const firstMethod = Array.from(payment.querySelectorAll('[name="payment-method"]')).find(input => !input.disabled);
    if (firstMethod) firstMethod.checked = true;
    button.disabled = !base || !firstMethod;
    setHidden($('#checkout-unavailable'), !!base);
    const panel = $('#payment-order-state'), accessButton = $('#access-pack');
    let paymentChecking = false, paymentTimer = 0, paymentPollUntil = Date.now() + 600000, lastPaymentStatus = '';
    function renderPix(value) {
      const pix = core.pix(value), code = $('#pix-code'), image = $('#pix-qr');
      setHidden($('#pix-checkout'), !pix);
      if (code) code.value = pix?.copyPaste || '';
      if (image) { setHidden(image, !pix?.qrCodeBase64); if (pix?.qrCodeBase64) image.src = pix.qrCodeBase64; else image.removeAttribute('src'); }
      say($('#pix-instructions'), pix?.qrCodeBase64 ? 'Escaneie o QR Code ou copie o código no aplicativo do seu banco.' : 'Copie o código e escolha Pix copia e cola no aplicativo do seu banco.');
      say($('#pix-copy-feedback'), '');
      say($('#pix-expiry'), pix ? 'Código válido até ' + new Date(pix.expiresAt).toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}) + ' (horário de Brasília).' : '');
    }
    $('#pix-copy')?.addEventListener('click', async () => {
      const code = $('#pix-code'); if (!code?.value) return;
      try { await navigator.clipboard.writeText(code.value); say($('#pix-copy-feedback'),'Código copiado. Abra o app do seu banco para pagar.'); }
      catch { code.focus(); code.select(); say($('#pix-copy-feedback'),'Selecione o código acima e copie para o aplicativo do seu banco.'); }
    });
    function showPaymentOrder(value, sample = false) {
      const order = core.order(value);
      // Um pedido anterior de outro pack não substitui a compra escolhida agora.
      if (order.pack !== id) { lastPaymentStatus = 'different-pack'; return; }
      const firstApproval = order.status === 'approved' && lastPaymentStatus !== 'approved';
      verifiedPaymentOrder = sample ? null : order; lastPaymentStatus = order.status;
      quote(); setHidden($('.payment-form-panel'), true); setHidden(panel, false);
      setHidden($('#delivery-preview'), true); setHidden($('#payment-result-preview'), !sample);
      $('#payment-refresh').disabled = sample;
      const approved = order.status === 'approved';
      if (approved) {
        const heading = $('.commerce-heading h1');
        if (heading) {
          const first = document.createElement('span'), line = document.createElement('br'), accent = document.createElement('span');
          first.textContent = 'Pagamento'; accent.className = 'purple'; accent.textContent = 'aprovado.';
          heading.replaceChildren(first, line, accent);
        }
      }
      panel.dataset.state = approved ? 'approved' : order.status === 'pending' ? 'pending' : 'problem';
      const text = {
        approved: ['PAGAMENTO APROVADO', 'Seu pack está pronto.', 'Acesse sua conversa para assistir ao tutorial passo a passo e baixar o pack.'],
        pending: ['AGUARDANDO PAGAMENTO', 'Falta só a confirmação.', 'Assim que o provedor confirmar o pagamento, o botão para acessar seu pack aparecerá aqui.'],
        rejected: ['PAGAMENTO NÃO APROVADO', 'Vamos conferir sua compra.', 'O pagamento não foi aprovado. Fale com a OSUK no Discord para conferir o pedido.'],
        cancelled: ['PEDIDO CANCELADO', 'Este pedido foi cancelado.', 'A entrega está bloqueada para este pedido. Consulte a OSUK no Discord se precisar de ajuda.'],
        refunded: ['PAGAMENTO REEMBOLSADO', 'Este pedido foi reembolsado.', 'O acesso à entrega foi encerrado para este pedido. Consulte a OSUK no Discord se precisar de ajuda.']
      }[order.status];
      say($('#payment-result-status'), sample ? 'PRÉVIA · PAGAMENTO APROVADO' : text[0]);
      say($('#payment-result-title'), text[1]); say($('#payment-result-description'), text[2]);
      renderPix(order.pix);
      if (order.pix) say($('#payment-result-description'), 'Pague pelo código abaixo. Esta página acompanha a confirmação e libera seu pack automaticamente.');
      else if (order.lookupPending) say($('#payment-result-description'), 'Estamos recuperando sua cobrança. Aguarde e use “Atualizar pagamento”. Se o Pix não aparecer, fale no Discord antes de iniciar outro pedido.');
      setHidden(accessButton, !approved);
      accessButton.href = approved ? sample ? 'entrega.html?pack=' + id + '&preview=1' : 'entrega.html?pack=' + id + '#acesso=' + access : 'entrega.html';
      const checkout = order.status === 'pending' && core.checkoutUrl(order.checkoutUrl, allowedOrigins);
      setHidden($('#resume-payment'), !checkout); $('#resume-payment').href = checkout || 'pagamento.html?pack=' + id;
      if (!sample && !motion.matches) panel.animate([{ opacity:0, transform:'translateY(8px)' },{ opacity:1, transform:'none' }], {duration:220,easing:'ease-out'});
      if (firstApproval) window.OSUK_APPROVAL_MOTION?.play();
    }
    function paymentSchedule() {
      clearTimeout(paymentTimer);
      if (base && access && !preview && !document.hidden && Date.now() < paymentPollUntil && (!lastPaymentStatus || lastPaymentStatus === 'pending')) paymentTimer = setTimeout(checkPayment, 15000);
    }
    async function checkPayment() {
      if (!base || !access || preview || paymentChecking) return;
      paymentChecking = true; $('#payment-refresh').disabled = true;
      say($('#payment-status-feedback'), 'Consultando o pagamento…');
      try { showPaymentOrder(await request('/orders/current', { accessToken: access })); say($('#payment-status-feedback'), 'Pedido atualizado.'); }
      catch (error) {
        setHidden(accessButton, true); accessButton.href = 'entrega.html';
        setHidden($('#resume-payment'), true);
        renderPix(null);
        if (!panel.hidden) {
          panel.dataset.state = 'problem';
          say($('#payment-result-status'), 'ACESSO NÃO CONFIRMADO'); say($('#payment-result-title'), 'Vamos conferir seu pedido.');
          say($('#payment-result-description'), 'Não foi possível consultar o pagamento agora. Tente atualizar novamente.');
        }
        say($('#payment-status-feedback'), error.message || 'Não foi possível consultar o pagamento.');
        if (panel.hidden) say($('#payment-feedback'), error.message || 'Não foi possível consultar o pagamento.');
      } finally { paymentChecking = false; $('#payment-refresh').disabled = false; paymentSchedule(); }
    }
    $('#payment-refresh')?.addEventListener('click', () => { paymentPollUntil = Date.now() + 600000; checkPayment(); });
    if (query.get('preview') === 'approved') showPaymentOrder({ pack:id, amountCents:core.quote(id,config.promotion).cents, status:'approved' }, true);
    else if (base && access) checkPayment();
    let submitting = false, attemptKey = '', attemptFingerprint = '', preparedAttempt = null;
    const mismatchMessage = 'Os e-mails precisam ser iguais. Confira e tente novamente.';
    const matching = () => {
      const mismatch = confirmation.value.trim() && confirmation.value.trim().toLowerCase() !== email.value.trim().toLowerCase();
      confirmation.setCustomValidity(mismatch ? mismatchMessage : '');
      confirmation.setAttribute('aria-invalid', String(!!mismatch));
      if (mismatch) say($('#payment-feedback'), mismatchMessage);
      else if ($('#payment-feedback')?.textContent === mismatchMessage) say($('#payment-feedback'), '');
    };
    [email, confirmation].forEach(input => { input.addEventListener('input', matching); input.addEventListener('change', matching); });
    payment.addEventListener('submit', async event => {
      event.preventDefault(); matching();
      if (!payment.reportValidity() || submitting) return;
      if (!base) { say($('#payment-feedback'), 'Pagamento em configuração. Você pode conhecer a prévia da entrega abaixo.'); return; }
      const method = payment.querySelector('[name="payment-method"]:checked')?.value;
      if (!methods.includes(method)) return;
      const fingerprint = id + ':' + email.value.trim().toLowerCase() + ':' + method;
      if (attemptFingerprint !== fingerprint) {
        attemptFingerprint = fingerprint; attemptKey = crypto.randomUUID();
      }
      submitting = true; button.disabled = true; say(button, 'Preparando pagamento…');
      say($('#payment-feedback'), 'Preparando seu pagamento via Pix…');
      try {
        const purchase = { pack:id, email:email.value.trim(), paymentMethod:method };
        let preparedToken, recoverOnly = false;
        if (settings.prepareOrder === true) {
          const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
          const digest = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2,'0')).join('');
          let previous = preparedAttempt;
          if (!previous) { try { previous = JSON.parse(sessionStorage.getItem('osuk-pix-attempt-' + id)); } catch {} }
          if (previous?.fingerprint === digest && core.token(previous.token) && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(previous.key || '')) preparedAttempt = previous;
          else {
            const prepared = await request('/orders/prepare', {method:'POST', body:purchase, idempotencyKey:attemptKey});
            preparedAttempt = null;
            if (!prepared.legacy) {
              const savedToken = core.token(prepared.accessToken), draft = core.order(prepared.order);
              if (!savedToken || draft.pack !== id || draft.status !== 'pending') throw Error('Não foi possível preparar o acesso ao pedido. Tente novamente.');
              preparedAttempt = {fingerprint:digest, key:attemptKey, token:savedToken, submitted:false};
            }
          }
          if (preparedAttempt) {
            preparedToken = preparedAttempt.token; attemptKey = preparedAttempt.key; recoverOnly = preparedAttempt.submitted === true;
            access = preparedToken; preparedAttempt.submitted = true;
            // O acesso criptografado fica salvo antes da criação do Pix; não contém a chave da API.
            try { sessionStorage.setItem('osuk-delivery-access',access); sessionStorage.setItem('osuk-pix-attempt-' + id,JSON.stringify(preparedAttempt)); } catch {}
          }
        }
        const data = await request('/orders', { method:'POST', body:preparedToken ? {...purchase,recoverOnly} : purchase, accessToken:preparedToken, idempotencyKey:attemptKey });
        const url = core.checkoutUrl(data.checkoutUrl, allowedOrigins), newAccess = core.token(data.accessToken);
        const order = data.order ? core.order(data.order) : null;
        if (!newAccess || (order ? order.pack !== id || (order.status === 'pending' && !order.pix) : !url)) throw Error('O pagamento retornou um acesso inválido. Entre no Discord para conferir sua compra.');
        // Apenas token opaco na sessão. E-mail, cartão e aprovação nunca são persistidos aqui.
        access = newAccess;
        try { sessionStorage.setItem('osuk-delivery-access', access); } catch {}
        const delivery = $('#delivery-preview');
        if (delivery) { delivery.href = 'pagamento.html?pack=' + id + '&retorno=1#acesso=' + access; delivery.textContent = 'Acompanhar pagamento'; }
        if (order) {
          paymentPollUntil = Date.now() + 600000; showPaymentOrder(order); paymentSchedule();
          say($('#payment-status-feedback'), 'Seu pedido foi criado. Aguardando o pagamento via Pix.');
        } else {
          say($('#payment-feedback'), 'Pedido criado. Abrindo o pagamento seguro…'); location.assign(url);
        }
      } catch (error) { say($('#payment-feedback'), error.message || 'Não foi possível abrir o pagamento. Tente novamente.'); }
      finally { submitting = false; button.disabled = false; say(button, 'Gerar QR Code Pix'); }
    });
    // Recalcula oferta real ao retornar do checkout; o servidor decide o preço final do pedido.
    window.addEventListener('pageshow', event => { quote(); if (event.persisted) { paymentPollUntil = Date.now() + 600000; checkPayment(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(paymentTimer); else paymentSchedule(); });
    window.addEventListener('pagehide', () => { clearTimeout(paymentTimer); controllers.forEach(controller => controller.abort()); });
  }

  if (!$('#delivery-thread')) return;
  const thread = $('#delivery-thread'), systemMessages = document.createElement('div'), conversation = document.createElement('div');
  thread.replaceChildren(systemMessages, conversation);
  function element(tag, className, text) {
    const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node;
  }
  function message(text, user = false, parent = conversation) {
    const row = element('div', 'chat-message' + (user ? ' user' : ''));
    const avatar = element('span', 'chat-avatar', user ? 'Você' : 'O'); avatar.setAttribute('aria-hidden', 'true');
    const bubble = element('div', 'chat-bubble'); bubble.append(element('strong', 'chat-sender', user ? 'Você' : 'OSUK · assistente de entrega'), element('p', '', text));
    row.append(avatar, bubble); parent.append(row);
    if (!motion.matches) row.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 200, easing: 'ease-out' });
    return bubble;
  }
  function summary(product, amount = product.cents) {
    say($('#delivery-pack-name'), product.name); say($('#delivery-summary-name'), product.name);
    say($('#delivery-summary-price'), core.money(amount));
    if ($('#delivery-payment-link')) $('#delivery-payment-link').href = 'pagamento.html?pack=' + id;
  }
  summary(core.quote(id, config.promotion));
  setHidden($('#delivery-mode'), !preview);
  function files(bubble, values, sample = false) {
    values.forEach(file => {
      const card = element('div', 'chat-file');
      card.append(element('span', 'chat-file-name', String(file.name || 'Pack digital').slice(0, 160)),
        element('small', 'chat-file-meta', sample ? 'Disponível após a confirmação do pagamento' : file.kind === 'drive-folder' ? 'Seus arquivos na pasta do Google Drive' : 'Arquivo da sua compra'));
      const safeUrl = !sample && core.https(file.url);
      if (safeUrl) {
        const link = element('a', 'button small', 'Baixar pack'); link.href = safeUrl.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer'; card.append(link);
      } else {
        const button = element('button', 'button small secondary', sample ? 'Baixar pack' : 'Arquivo em preparação'); button.type = 'button'; button.disabled = true; card.append(button);
      }
      bubble.append(card);
    });
  }
  function tutorialVideo(bubble, value, sample = false) {
    const url = !sample && core.https(value);
    if (!sample && !url) return;
    const card = element('div', 'chat-file');
    card.append(element('span', 'chat-file-name', 'Tutorial passo a passo'), element('small', 'chat-file-meta', sample ? 'Vídeo no YouTube · disponível após a confirmação' : 'Assista às orientações do ' + core.catalog[id].name + ' no YouTube.'));
    const action = element(sample ? 'button' : 'a', 'button small secondary', 'Assistir tutorial');
    if (sample) { action.type = 'button'; action.disabled = true; }
    else { action.href = url.href; action.target = '_blank'; action.rel = 'noopener noreferrer'; action.referrerPolicy = 'no-referrer'; }
    card.append(action); bubble.append(card);
  }
  function tutorial(bubble, steps, sample = false) {
    const group = element('div', 'chat-tutorial'); group.append(element('h2', '', sample ? 'Como a entrega vai funcionar' : 'Seu tutorial passo a passo'));
    steps.forEach((step, index) => {
      const details = element('details', 'chat-tutorial-step');
      const title = element('summary'); title.append(element('span', 'chat-step-number', String(index + 1)), element('span', '', String(step.title || 'Passo ' + (index + 1)).slice(0, 160)));
      details.append(title, element('p', '', String(step.body || '').slice(0, 12000))); details.open = index === 0; group.append(details);
    });
    bubble.append(group);
  }
  let signature = '', lastOrder = null, refreshing = false, timer = 0, pollUntil = Date.now() + 600000;
  const labels = { pending: 'Aguardando pagamento', approved: 'Pagamento confirmado', rejected: 'Pagamento não aprovado', cancelled: 'Pedido cancelado', refunded: 'Pagamento reembolsado' };
  function render(value) {
    const order = core.order(value);
    id = order.pack; lastOrder = order;
    summary(core.catalog[id], order.amountCents);
    say($('#delivery-order-id'), String(order.orderId || 'Pedido').slice(0, 80));
    say($('#delivery-email'), String(order.emailMasked || 'E-mail da compra').slice(0, 254));
    say($('#delivery-status'), labels[order.status]); say($('#delivery-progress'), order.status === 'approved' ? 'Pagamento confirmado · entrega liberada' : 'Entrega após a confirmação');
    $('#delivery-status').dataset.state = order.status === 'approved' ? 'approved' : order.status === 'pending' ? 'pending' : 'problem';
    const next = JSON.stringify([order.pack, order.status, order.files, order.tutorialUrl, order.tutorial]);
    if (next === signature) return; signature = next; systemMessages.replaceChildren();
    if (order.status === 'approved') {
      const bubble = message('Pagamento confirmado! Seu ' + core.catalog[id].name + ' fica disponível aqui, junto das orientações para usar no seu ritmo.', false, systemMessages);
      tutorialVideo(bubble, order.tutorialUrl);
      files(bubble, order.files);
      if (order.tutorial.length) tutorial(bubble, order.tutorial);
      if (!order.files.length || (!order.tutorial.length && !order.tutorialUrl)) message('A confirmação já chegou. Estamos preparando os arquivos e as orientações. Atualize o pedido em instantes ou fale com a OSUK no Discord.', false, systemMessages);
    } else if (order.status === 'pending') message('Seu pedido está aguardando a confirmação do pagamento. Assim que ela chegar, o pack e o tutorial aparecerão nesta conversa.', false, systemMessages);
    else message(labels[order.status] + '. A entrega está bloqueada para este pedido. Se precisar conferir o pagamento, fale com a OSUK no Discord.', false, systemMessages);
  }
  async function refresh() {
    if (preview || !base || !access || refreshing) return;
    refreshing = true; $('#delivery-refresh').disabled = true; say($('#delivery-feedback'), 'Consultando seu pedido…');
    try { render(await request('/orders/current', { accessToken: access })); say($('#delivery-feedback'), 'Pedido atualizado.'); }
    catch (error) {
      // Nunca mantenha URLs de entrega visíveis depois de uma consulta de autorização que falhou.
      if (lastOrder?.status === 'approved') { systemMessages.replaceChildren(); signature = ''; say($('#delivery-status'), 'Não foi possível verificar o acesso'); }
      say($('#delivery-feedback'), error.message || 'Não foi possível consultar. Tente novamente.');
    } finally { refreshing = false; $('#delivery-refresh').disabled = false; schedule(); }
  }
  function schedule() {
    clearTimeout(timer);
    if (!preview && base && access && !document.hidden && Date.now() < pollUntil && (!lastOrder || lastOrder.status === 'pending' || (lastOrder.status === 'approved' && (!lastOrder.files.length || (!lastOrder.tutorial.length && !lastOrder.tutorialUrl))))) timer = setTimeout(refresh, 15000);
  }
  if (preview) {
    say($('#delivery-status'), 'Prévia da entrega'); say($('#delivery-order-id'), 'Exemplo'); say($('#delivery-progress'), 'Modelo de entrega após a confirmação');
    const bubble = message('Aqui você encontrará o tutorial passo a passo e o download do seu ' + core.catalog[id].name + '. Esta é uma prévia; os links são liberados após a confirmação do pagamento.', false, systemMessages);
    tutorialVideo(bubble, null, true);
    files(bubble, [{ name: core.catalog[id].name }], true);
    tutorial(bubble, [
      { title: 'Receba o pack', body: 'Quando o pagamento for confirmado, o arquivo do pack ficará disponível nesta área.' },
      { title: 'Leia antes de aplicar', body: 'O tutorial definitivo apresentará requisitos, preparação e instruções específicas do pack adquirido.' },
      { title: 'Aplique seguindo a ordem', body: 'Cada etapa do tutorial aparecerá aqui. As instruções reais serão inseridas junto dos arquivos do produto.' },
      { title: 'Conte com a OSUK', body: 'Use o Discord se precisar de suporte para seguir as orientações.' }
    ], true);
    $('#delivery-refresh').disabled = true;
  } else if (base && access) refresh();
  else {
    say($('#delivery-status'), 'Acesso ao pedido'); say($('#delivery-progress'), 'Finalize a compra para acessar a entrega');
    message('Aqui você receberá seu pack e o tutorial. Use o acesso do pedido criado no pagamento. Para conhecer o formato enquanto a compra está em configuração, abra a prévia na página de pagamento.', false, systemMessages);
    $('#delivery-refresh').disabled = true;
  }
  $('#delivery-refresh').addEventListener('click', () => { pollUntil = Date.now() + 600000; refresh(); });
  $('#chat-form').addEventListener('submit', event => {
    event.preventDefault(); const input = $('#chat-question'), text = input.value.trim().slice(0, 500); if (!text) return;
    message(text, true); message(core.reply(text)); input.value = ''; input.focus({ preventScroll: true });
    while (conversation.children.length > 20) conversation.firstElementChild.remove();
    conversation.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: motion.matches ? 'instant' : 'smooth' });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else schedule(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { pollUntil = Date.now() + 600000; refresh(); } });
  window.addEventListener('pagehide', () => { clearTimeout(timer); controllers.forEach(controller => controller.abort()); });
})();
