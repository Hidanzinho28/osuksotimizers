(() => {
  'use strict';
  const config = window.OSUK_CONFIG || {};
  const $ = selector => document.querySelector(selector);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function animateState(element) { if (!element || reducedMotion.matches) return; element.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' }); }
  function addArrow(element) { if (!element) return; element.textContent = element.textContent.replace(/↗/g, '').trim(); const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('class','icon'); svg.setAttribute('aria-hidden','true'); const use = document.createElementNS('http://www.w3.org/2000/svg','use'); use.setAttribute('href','#arrow-up-right'); svg.append(use); element.append(svg); }
  addArrow($('#quiz-next'));
  const packs = { ultra: { name: 'Ultra Pack', price: '35,90' }, valorant: { name: 'Valorant Booster', price: '22,90' }, completo: { name: 'Pack Completo', price: '17,90' } };
  const isHttps = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
  if (isHttps(config.siteUrl)) {
    const base = new URL(config.siteUrl); base.search = ''; base.hash = '';
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    const filename = location.pathname.split('/').pop() || 'index.html';
    const canonical = new URL(filename, base).href;
    const link = document.createElement('link'); link.rel = 'canonical'; link.href = canonical; document.head.append(link);
    const meta = document.createElement('meta'); meta.setAttribute('property', 'og:url'); meta.content = canonical; document.head.append(meta);
  }
  const menu = $('.menu-toggle');
  menu?.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); $('#nav').classList.toggle('open', open); });
  // Shrink after leaving the top; a separate threshold prevents flickering.
  const stickyHeader = $('header');
  let compactHeaderFrame = 0;
  function syncCompactHeader() {
    compactHeaderFrame = 0;
    if (!stickyHeader) return;
    if (window.scrollY > 90) stickyHeader.classList.add('is-compact');
    else if (window.scrollY < 35) stickyHeader.classList.remove('is-compact');
  }
  function onCompactHeaderScroll() {
    if (!compactHeaderFrame) compactHeaderFrame = requestAnimationFrame(syncCompactHeader);
  }
  window.addEventListener('scroll', onCompactHeaderScroll, { passive: true });
  window.addEventListener('pageshow', syncCompactHeader);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(compactHeaderFrame); compactHeaderFrame = 0; });
  syncCompactHeader();
  const closeMenu = () => { menu?.setAttribute('aria-expanded', 'false'); $('#nav')?.classList.remove('open'); };
  document.querySelectorAll('#nav a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
      const focusInMenu = $('#nav')?.contains(document.activeElement);
      closeMenu(); if (focusInMenu) menu.focus();
    }
  });
  document.addEventListener('click', event => {
    if (menu?.getAttribute('aria-expanded') === 'true' && !stickyHeader?.contains(event.target)) closeMenu();
  });
  matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  if ($('#year')) $('#year').textContent = new Date().getFullYear();
  const campaign = config.campaigns?.[new URLSearchParams(location.search).get('campanha')];
  if (campaign && $('#campaign-eyebrow')) { $('#campaign-eyebrow').textContent = campaign.eyebrow; $('#campaign-subtitle').textContent = campaign.subtitle; }
  const dialog = $('#checkout-dialog');
  function openContact() {
    if (isHttps(config.discord)) { window.open(config.discord, '_blank', 'noopener,noreferrer'); return; }
    $('#checkout-title').textContent = 'Contato em preparação'; $('#checkout-description').textContent = 'O convite do Discord ainda não foi configurado.'; $('#checkout-actions').replaceChildren(); if (!dialog.open) dialog.showModal();
  }
  document.querySelectorAll('button.contact').forEach(button => button.addEventListener('click', openContact));
  document.querySelectorAll('a.contact').forEach(link => {
    if (isHttps(config.discord)) link.href = config.discord;
    else link.addEventListener('click', event => { event.preventDefault(); openContact(); });
  });
  function openCheckout(id) {
    const pack = packs[id]; if (!pack) return;
    location.assign('pagamento.html?pack=' + encodeURIComponent(id));
  }
  document.querySelectorAll('.buy').forEach(button => button.addEventListener('click', () => openCheckout(button.dataset.pack)));
  $('.dialog-close')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  // Demo values are disclosed. Real campaigns require a shared, absolute start date.
  const promotionBar = $('#promotion-bar');
  if (promotionBar) {
    const offer = config.promotion || {};
    const currency = cents => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sale = { ultra: 3590, valorant: 2290, completo: 1790 };
    const regular = offer.regularPricesCents || {};
    const duration = 3 * 60 * 60 * 1000;
    const demo = offer.demo === true;
    const start = Date.parse(offer.startsAt || '');
    const validPrices = Object.keys(sale).every(id => Number.isSafeInteger(regular[id]) && regular[id] > sale[id]);
    let end = start + duration;
    let active = null, ticking = 0;
    if (demo) {
      const key = 'osuk-promotion-preview-session-end-v2';
      let saved = null;
      try { saved = Number(sessionStorage.getItem(key)); } catch {}
      end = Number.isFinite(saved) && saved > 0 ? saved : Date.now() + duration;
      try { sessionStorage.setItem(key, String(end)); } catch {}
      $('#promotion-note').textContent = 'Prévia de 3 horas por visita. Preços anteriores, descontos e economias de exemplo.';
      $('#promotion-title').textContent = 'Promoção por 3 horas';
    } else {
      $('#promotion-note').textContent = 'Valores promocionais durante o período indicado.';
    }
    if (validPrices && (demo || Number.isFinite(start))) {
      promotionBar.hidden = false;
      function updateOffer(enabled) {
        active = enabled;
        // Keep illustrative pricing visible after the demo timer ends; real offers still expire.
        const showDiscount = demo || enabled;
        Object.keys(sale).forEach(id => {
          // Product pages contain only their selected pack; pricing stays synchronized across pages.
          if (!demo) packs[id].price = currency(enabled ? sale[id] : regular[id]);
          const card = $('#pack-' + id);
          if (!card) return;
          card.classList.toggle('has-promotion', showDiscount);
          card.querySelectorAll('.promo-only').forEach(element => { element.hidden = !showDiscount; });
          card.querySelector('.regular-price').textContent = 'De R$ ' + currency(regular[id]);
          const discount = Math.round((1 - sale[id] / regular[id]) * 100);
          card.querySelector('.promo-percent').textContent = discount + '%';
          card.querySelector('.promo-seal').setAttribute('aria-label', discount + '% de desconto' + (demo ? ', exemplo' : ''));
          card.querySelector('.saving-amount').textContent = 'R$ ' + currency(regular[id] - sale[id]);
          // Demo never changes actual pack prices. A real expired offer restores base prices.
          if (!demo) {
            card.querySelector('.price strong').textContent = packs[id].price;
          }
        });
        if (!demo && dialog?.open) dialog.close();
      }
      function tick() {
        const now = Date.now();
        const future = !demo && now < start;
        const remaining = Math.max(0, Math.ceil(((future ? start : end) - now) / 1000));
        const enabled = !future && now < end;
        if (active !== enabled) updateOffer(enabled);
        $('#promotion-hours').textContent = String(Math.floor(remaining / 3600)).padStart(2,'0');
        $('#promotion-minutes').textContent = String(Math.floor(remaining % 3600 / 60)).padStart(2,'0');
        $('#promotion-seconds').textContent = String(remaining % 60).padStart(2,'0');
        const label = future ? 'A promoção começa em' : enabled ? (demo ? 'Tempo desta visita' : 'Termina em') : demo ? 'Prévia encerrada' : 'Promoção encerrada';
        $('#promotion-status').hidden = demo && !enabled;
        if ($('#promotion-status').textContent !== label) $('#promotion-status').textContent = label;
        promotionBar.classList.toggle('is-ended', !future && !enabled);
        if (!future && !enabled) { clearInterval(ticking); ticking = 0; }
      }
      function resume() { clearInterval(ticking); ticking = 0; tick(); if (Date.now() < end && !document.hidden) ticking = setInterval(tick, 1000); }
      document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInterval(ticking); ticking = 0; } else resume(); });
      window.addEventListener('pagehide', () => { clearInterval(ticking); ticking = 0; });
      window.addEventListener('pageshow', resume);
      resume();
    }
  }

  const questions = [
    { title: 'Qual é o seu foco principal?', options: [['valorant', 'Jogo principalmente Valorant'], ['varios', 'Jogo vários títulos'], ['geral', 'Quero melhorar a experiência geral do PC']] },
    { title: 'O que mais incomoda hoje?', options: [['fps', 'Quedas de FPS durante o jogo'], ['sistema', 'Inicialização ou sistema lento'], ['ambos', 'Um pouco dos dois']] },
    { title: 'Como você se sente ao ajustar o Windows?', options: [['iniciante', 'Prefiro começar com orientações básicas'], ['intermediario', 'Já conheço o básico e quero ir além'], ['avancado', 'Quero revisar meu setup por completo']] },
    { title: 'Qual escopo você procura?', options: [['basico', 'Uma base de ajustes gerais'], ['focado', 'Ajustes direcionados ao meu jogo'], ['amplo', 'Uma revisão mais ampla para vários jogos']] }
  ];
  let step = 0; const answers = [];
  function renderQuestion() {
    if (!$('#quiz-question')) return;
    const field = $('#quiz-question'); field.replaceChildren();
    const legend = document.createElement('legend'); legend.textContent = questions[step].title; field.append(legend);
    questions[step].options.forEach(([value, labelText]) => {
      const label = document.createElement('label'); label.className = 'quiz-option'; const input = document.createElement('input'); input.type = 'radio'; input.name = 'answer'; input.value = value; input.checked = answers[step] === value; label.append(input, document.createTextNode(labelText)); field.append(label);
    });
    $('#question-number').textContent = 'PERGUNTA 0' + (step + 1) + ' / 04'; $('#quiz-progress').value = step + 1; $('#quiz-back').hidden = step === 0; $('#quiz-next').textContent = step === 3 ? 'Ver meu pack ↗' : 'Continuar ↗'; $('#quiz-error').textContent = ''; $('#quiz-progress-fill').style.transform = 'scaleX(' + ((step + 1) / 4) + ')'; addArrow($('#quiz-next')); animateState(field);
  }
  $('#quiz-back')?.addEventListener('click', () => { const selected = $('input[name="answer"]:checked'); if (selected) answers[step] = selected.value; if (step > 0) step--; renderQuestion(); $('#quiz-question input')?.focus(); });
  $('#quiz')?.addEventListener('submit', event => {
    event.preventDefault(); const selected = $('input[name="answer"]:checked');
    if (!selected) { $('#quiz-error').textContent = 'Escolha uma opção para continuar.'; $('#quiz-question input').focus(); return; }
    answers[step] = selected.value;
    if (step < 3) { step++; renderQuestion(); $('#quiz-question input').focus(); return; }
    const id = answers[3] === 'amplo' ? 'ultra' : answers[3] === 'basico' ? 'completo' : answers[0] === 'valorant' ? 'valorant' : answers[0] === 'varios' || answers[1] === 'ambos' || answers[2] === 'avancado' ? 'ultra' : 'completo';
    const result = $('#quiz-result'); result.replaceChildren(); const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'SUGESTÃO PARA O SEU PERFIL'; const title = document.createElement('h3'); title.textContent = packs[id].name + ' · R$ ' + packs[id].price;
    const explanation = document.createElement('p'); explanation.textContent = { ultra: 'Você sinalizou interesse em uma revisão mais ampla ou em vários jogos. O Ultra Pack é a sugestão de maior escopo.', valorant: 'Seu foco é Valorant e você procura ajustes direcionados. O Valorant Booster é a sugestão mais específica.', completo: 'Você procura uma base de ajustes gerais. O Pack Completo é a sugestão para começar.' }[id] + ' Confirme hardware, compatibilidade e conteúdo antes da compra.';
    const button = document.createElement('button'); button.className = 'button'; button.textContent = 'Ver pack recomendado ↗'; button.addEventListener('click', () => { const target = $('#pack-' + id); target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'center' }); target.tabIndex = -1; target.focus({ preventScroll: true }); });
    const restart = document.createElement('button'); restart.className = 'text-link'; restart.textContent = 'Refazer diagnóstico'; restart.addEventListener('click', () => { answers.length = 0; step = 0; result.hidden = true; $('#quiz').hidden = false; renderQuestion(); $('#quiz-question input').focus(); });
    result.append(eyebrow, title, explanation, button, document.createElement('br'), restart); $('#quiz').hidden = true; result.hidden = false; title.tabIndex = -1; title.focus(); addArrow(button); animateState(result);
  });
  renderQuestion();
  if ($('#quiz')) $('#quiz').hidden = false;
  let consent = null; try { consent = localStorage.getItem('osuk-consent'); } catch {}
  let trackingLoaded = false;
  function loadTracking() {
    // Pedido, e-mail e acesso de entrega não entram nos rastreadores da vitrine.
    if ($('#payment-form') || $('#delivery-thread')) return;
    if (trackingLoaded || consent !== 'accepted') return;
    const google = config.analytics?.google;
    if (/^G-[A-Z0-9]+$/.test(google || '')) { trackingLoaded = true; window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); }; window.gtag('js', new Date()); window.gtag('config', google); const script = document.createElement('script'); script.async = true; script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(google); document.head.append(script); }
    // TikTok Pixel: ponto de integração intencionalmente inativo.
    // Insira aqui o snippet oficial atual do painel TikTok, usando config.analytics.tiktok.
    // Não carregue fora desta função: ela exige consentimento.
  }
  const hasAnalytics = !$('#payment-form') && !$('#delivery-thread') && /^G-[A-Z0-9]+$/.test(config.analytics?.google || '');
  const banner = $('#cookie-banner'); if (banner) banner.hidden = consent !== null || !hasAnalytics;
  function saveConsent(value) { const mustReload = trackingLoaded && value === 'rejected'; consent = value; try { localStorage.setItem('osuk-consent', value); } catch {} banner.hidden = true; if (mustReload) location.reload(); else loadTracking(); }
  $('#cookie-accept')?.addEventListener('click', () => saveConsent('accepted'));
  $('#cookie-reject')?.addEventListener('click', () => saveConsent('rejected'));
  $('#cookie-settings')?.addEventListener('click', () => { banner.hidden = false; }); loadTracking();
  // Centered carousel with neighboring screenshots always visible.
  const carousel = $('.review-carousel');
  if (carousel) {
    const slides = Array.from(carousel.querySelectorAll('.review-slide'));
    const stage = carousel.querySelector('.review-stage');
    const reviewDialog = $('#review-dialog');
    let current = 0, timer = 0, hovered = false, focused = false, inView = false, suspended = false;
    let touchStart = null, suppressClickUntil = 0;
    function clearTimer() { clearTimeout(timer); timer = 0; }
    function schedule() {
      clearTimer();
      if (!reducedMotion.matches && !hovered && !focused && inView && !suspended && !document.hidden && !reviewDialog.open)
        timer = setTimeout(() => show(current + 1), 5200);
    }
    function show(target, announce = false) {
      current = (target + slides.length) % slides.length;
      carousel.dataset.current = String(current);
      slides.forEach((slide, index) => {
        const position = (index - current + slides.length + 3) % slides.length - 3;
        const visible = Math.abs(position) <= 1;
        slide.style.setProperty('--position', String(position));
        slide.style.setProperty('--scale', position === 0 ? '1' : '.82');
        slide.classList.toggle('is-center', position === 0);
        slide.classList.toggle('is-neighbor', Math.abs(position) === 1);
        slide.classList.toggle('is-away', !visible);
        slide.inert = !visible;
        slide.setAttribute('aria-hidden', String(!visible));
        const button = slide.querySelector('button');
        button.tabIndex = visible ? 0 : -1;
        button.setAttribute('aria-label', (position === 0 ? 'Ampliar' : 'Ver') + ' avaliação de ' + slide.dataset.name);
      });
      if (announce) carousel.querySelector('.review-status').textContent = slides[current].getAttribute('aria-label');
      schedule();
    }
    slides.forEach((slide, index) => slide.querySelector('button').addEventListener('click', () => {
      if (Date.now() < suppressClickUntil) return;
      if (index !== current) { show(index, true); return; }
      const image = slide.querySelector('img');
      const full = $('#review-full-image');
      full.src = image.src; full.alt = image.alt;
      const crop = $('#review-full-crop');
      crop.setAttribute('style', slide.querySelector('.review-crop').getAttribute('style'));
      $('#review-full-caption').textContent = image.alt + ' Resultados individuais; o ganho depende do setup.';
      clearTimer(); reviewDialog.showModal();
    }));
    carousel.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovered = true; schedule(); } });
    carousel.addEventListener('pointerleave', () => { hovered = false; schedule(); });
    carousel.addEventListener('focusin', () => { focused = true; schedule(); });
    carousel.addEventListener('focusout', () => { queueMicrotask(() => { focused = carousel.contains(document.activeElement); schedule(); }); });
    carousel.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); show(current + (event.key === 'ArrowRight' ? 1 : -1), true);
        slides[current].querySelector('button').focus({ preventScroll: true });
      }
    });
    stage.addEventListener('touchstart', event => {
      touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
      clearTimer();
    }, { passive: true });
    stage.addEventListener('touchend', event => {
      if (touchStart) {
        const touch = event.changedTouches[0], dx = touch.clientX - touchStart.x, dy = touch.clientY - touchStart.y;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          suppressClickUntil = Date.now() + 600; show(current + (dx < 0 ? 1 : -1), true);
        }
      }
      touchStart = null; schedule();
    }, { passive: true });
    stage.addEventListener('touchcancel', () => { touchStart = null; schedule(); }, { passive: true });
    $('.review-modal-close').addEventListener('click', () => reviewDialog.close());
    reviewDialog.addEventListener('close', schedule);
    reviewDialog.addEventListener('click', event => {
      if (event.target !== reviewDialog) return;
      const rect = reviewDialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) reviewDialog.close();
    });
    document.addEventListener('visibilitychange', schedule);
    reducedMotion.addEventListener('change', schedule);
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting && entries[0].intersectionRatio >= .15;
      if (inView) slides.forEach(slide => { slide.querySelector('img').loading = 'eager'; });
      schedule();
    }, { threshold: [0,.15] }) : null;
    if (observer) observer.observe(carousel); else inView = true;
    window.addEventListener('pagehide', () => { suspended = true; clearTimer(); observer?.disconnect(); });
    window.addEventListener('pageshow', () => { suspended = false; observer?.observe(carousel); schedule(); });
    show(0);
  }

  // Launch only after downward scroll. Passive input + one frame per update.
  const rocket = $('.scroll-rocket');
  let rocketFlight = null;
  let scrollFrame = 0;
  let previousY = window.scrollY;
  let scrollDirection = 1;
  let downwardTravel = 0;
  let lastLaunch = -Infinity;
  let scrollAttached = false;
  function stopRocket() {
    rocketFlight?.cancel(); rocketFlight = null;
    rocket?.classList.remove('is-flying');
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = 0; downwardTravel = 0;
  }
  function launchRocket(now) {
    if (!rocket || reducedMotion.matches || rocketFlight || dialog?.open || $('#review-dialog')?.open || $('#nav')?.classList.contains('open')) return;
    lastLaunch = now;
    rocket.classList.add('is-flying');
    rocketFlight = rocket.animate([
      { transform: `translate3d(0,${window.innerHeight + 140}px,0)`, opacity: 0, offset: 0 },
      { transform: `translate3d(0,${window.innerHeight * .8}px,0)`, opacity: 1, offset: .14 },
      { transform: 'translate3d(0,-160px,0)', opacity: 1, offset: .92 },
      { transform: 'translate3d(0,-200px,0)', opacity: 0, offset: 1 }
    ], { duration: 1450, easing: 'cubic-bezier(.35,.05,.65,.95)' });
    rocketFlight.onfinish = () => { rocketFlight = null; rocket.classList.remove('is-flying'); };
  }
  function onPageScroll() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(now => {
      scrollFrame = 0;
      const currentY = window.scrollY;
      const delta = currentY - previousY;
      previousY = currentY;
      if (delta !== 0) scrollDirection = delta > 0 ? 1 : -1;
      if (delta <= 0) { downwardTravel = 0; return; }
      downwardTravel += delta;
      if (downwardTravel >= 90 && now - lastLaunch >= 2300) {
        downwardTravel = 0; launchRocket(now);
      }
    });
  }
  function syncRocketScroll() {
    previousY = window.scrollY;
    if (reducedMotion.matches) {
      window.removeEventListener('scroll', onPageScroll); scrollAttached = false; stopRocket();
    } else if (!scrollAttached) {
      window.addEventListener('scroll', onPageScroll, { passive: true }); scrollAttached = true;
    }
  }
  reducedMotion.addEventListener('change', syncRocketScroll);
  window.addEventListener('pagehide', () => { window.removeEventListener('scroll', onPageScroll); scrollAttached = false; stopRocket(); });
  window.addEventListener('pageshow', syncRocketScroll);
  syncRocketScroll();
  const syncCouponMotion = () => document.documentElement.classList.toggle('motion-paused', document.hidden);
  document.addEventListener('visibilitychange', syncCouponMotion);
  syncCouponMotion();
  // Readable content remains visible if JavaScript or the observer is unavailable.
  document.querySelectorAll('details').forEach(details => details.addEventListener('toggle', () => { if (details.open) Array.from(details.children).filter(child => child.tagName !== 'SUMMARY').forEach(animateState); }));
  // Each block reveals again whenever it re-enters the viewport in either direction.
  const revealObservers = [];
  const activeReveals = new Map();
  const revealSelector = [
    '.hero-copy', '.hero-visual', '.info-hero > h1', '.info-hero > .lead',
    '.review-section > .section-head', '.review-carousel', '.review-link > *', '.impact-stat', '.games-section > h2', '.games-section > p', '.games > span',
    '.section-head', '.pack', '.pack-comparison', '.delivery-flow li', '.footer-navigation a', '.how-summary > div', '.how-summary > a',
    '.product-copy', '.feature-group', '.product-delivery li',
    '.security > div:first-child', '.security-items article', '#depoimentos > h2',
    '#depoimentos > .proof-details', '.creator-mark', '.about > div:not(.creator-mark)',
    '.faq > div:first-child', '.faq details', '.quiz-wrap > div', '.quiz-wrap > form',
    '.how-facts article', '.how-process > h2', '.how-process > .micro', '.how-flow li',
    '.how-next > div', '.how-next > p', '.final-cta > div', '.footer-main > *'
  ].join(',');
  function clearScrollReveals() {
    revealObservers.splice(0).forEach(observer => observer.disconnect());
    activeReveals.forEach(animation => animation.cancel()); activeReveals.clear();
  }
  function setupScrollReveals() {
    if (!('IntersectionObserver' in window) || reducedMotion.matches || revealObservers.length) return;
    const visible = new WeakMap();
    const targets = Array.from(document.querySelectorAll(revealSelector));
    targets.forEach((element,index) => { element.dataset.revealDelay = String((index % 3) * 45); });
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      const element = entry.target;
      const inView = entry.isIntersecting && entry.intersectionRatio >= .08;
      if (!inView) {
        visible.set(element,false); element.classList.remove('in-view');
        activeReveals.get(element)?.cancel(); activeReveals.delete(element);
        return;
      }
      if (visible.get(element)) return;
      visible.set(element,true); element.classList.add('in-view');
      const offset = scrollDirection * 34;
      element.dataset.revealDirection = offset < 0 ? 'up' : 'down';
      element.dataset.revealCount = String(Number(element.dataset.revealCount || 0) + 1);
      if (element.contains(document.activeElement)) return;
      activeReveals.get(element)?.cancel();
      const animation = element.animate([
        { opacity: 0, transform: 'translate3d(0,' + offset + 'px,0) scale(.985)' },
        { opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }
      ], { duration: 640, delay: Number(element.dataset.revealDelay), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
      activeReveals.set(element,animation);
      animation.finished.then(() => { if (activeReveals.get(element) === animation) activeReveals.delete(element); }, () => {});
    }), { threshold: [0,.08], rootMargin: '0px 0px -24px 0px' });
    targets.forEach(element => observer.observe(element)); revealObservers.push(observer);
    const hero = document.querySelector('.hero');
    if (hero) {
      const headerObserver = new IntersectionObserver(entries => document.querySelector('header')?.classList.toggle('scrolled',!entries[0].isIntersecting), { rootMargin: '-94px 0px 0px 0px' });
      headerObserver.observe(hero); revealObservers.push(headerObserver);
    }
  }
  reducedMotion.addEventListener('change', () => { clearScrollReveals(); setupScrollReveals(); });
  window.addEventListener('pagehide', clearScrollReveals);
  window.addEventListener('pageshow', setupScrollReveals);
  setupScrollReveals();

  // Animate a finite count only while its section is visible. Static HTML is the fallback.
  const numberSection = $('#numeros');
  const numberCounters = Array.from(document.querySelectorAll('[data-count-to]'));
  const numberFormat = new Intl.NumberFormat('pt-BR');
  let numberFrame = 0, numberObserver = null, numbersVisible = false;
  function finishNumbers() {
    cancelAnimationFrame(numberFrame); numberFrame = 0;
    numberCounters.forEach(counter => { counter.textContent = numberFormat.format(Number(counter.dataset.countTo)); });
    if (numberSection) numberSection.dataset.countState = 'complete';
  }
  function startNumbers() {
    cancelAnimationFrame(numberFrame);
    if (reducedMotion.matches || document.hidden) { finishNumbers(); return; }
    numberCounters.forEach(counter => { counter.textContent = '0'; });
    numberSection.dataset.countState = 'running';
    const started = performance.now(), duration = 1900;
    function tick(now) {
      const progress = Math.min(1, Math.max(0, (now - started) / duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      numberCounters.forEach(counter => {
        const value = numberFormat.format(Math.floor(Number(counter.dataset.countTo) * eased));
        if (counter.textContent !== value) counter.textContent = value;
      });
      if (progress < 1) numberFrame = requestAnimationFrame(tick);
      else finishNumbers();
    }
    numberFrame = requestAnimationFrame(tick);
  }
  function setupNumberCounters() {
    if (!numberSection || !numberCounters.length) return;
    numberObserver?.disconnect(); numbersVisible = false; finishNumbers();
    if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
    numberObserver = new IntersectionObserver(entries => {
      const entry = entries[0];
      // Hysteresis: count on entry, re-arm only after the whole section has left the screen.
      if (!entry.isIntersecting) { numbersVisible = false; finishNumbers(); return; }
      if (entry.intersectionRatio >= .3 && !numbersVisible) { numbersVisible = true; startNumbers(); }
    }, { threshold: [0, .3] });
    numberObserver.observe(numberSection);
  }
  reducedMotion.addEventListener('change', setupNumberCounters);
  document.addEventListener('visibilitychange', () => { if (document.hidden) finishNumbers(); });
  window.addEventListener('pagehide', () => { numberObserver?.disconnect(); finishNumbers(); });
  window.addEventListener('pageshow', setupNumberCounters);
  setupNumberCounters();

})();
