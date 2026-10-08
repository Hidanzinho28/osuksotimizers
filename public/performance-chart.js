(() => {
  'use strict';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  // Before/after FPS confirmed by the OSUK owner. No intermediate measurements are invented.
  const controllers = [];
  document.querySelectorAll('.performance-proof').forEach(section => {
    const after = section.querySelector('.performance-after'), area = section.querySelector('.performance-area'), dot = section.querySelector('.performance-dot');
    const lines = section.querySelector('.performance-lines'), bars = section.querySelector('.performance-bars');
    const buttons = [...section.querySelectorAll('.performance-tab')];
    let animations = [], mode = 'evolucao', visible = false;
    function stop() { animations.forEach(animation => animation.cancel()); animations = []; }
    function draw(animate = true) {
      stop();
      lines.toggleAttribute('hidden',mode !== 'evolucao'); bars.toggleAttribute('hidden',mode !== 'comparacao');
      section.querySelector('.performance-description').textContent = mode === 'evolucao'
        ? 'Comparação informada pela OSUK: 46 FPS antes e 165 FPS depois. A linha conecta esses dois valores; não representa amostras intermediárias.'
        : 'Comparação em barras informada pela OSUK: 46 FPS antes e 165 FPS depois, na mesma escala.';
      buttons.forEach(button => button.setAttribute('aria-pressed',String(button.dataset.chartMode === mode)));
      if (!animate || motion.matches || typeof after.animate !== 'function') return;
      if (mode === 'evolucao') {
        const length = after.getTotalLength();
        animations = [
          after.animate([{strokeDasharray:`${length} ${length}`,strokeDashoffset:length},{strokeDasharray:`${length} ${length}`,strokeDashoffset:0}],{duration:1000,easing:'cubic-bezier(.22,1,.36,1)'}),
          area.animate([{opacity:0},{opacity:.12}],{duration:800,easing:'ease-out'}),
          dot.animate([{opacity:0},{opacity:1}],{duration:180,delay:750,fill:'backwards',easing:'ease-out'})
        ];
      } else {
        animations = [...bars.querySelectorAll('rect')].map((bar,index) => bar.animate([{transform:'scaleY(0)'},{transform:'scaleY(1)'}],{duration:850,delay:index*70,fill:'backwards',easing:'cubic-bezier(.22,1,.36,1)'}));
      }
    }
    buttons.forEach(button => button.addEventListener('click',() => { if(mode === button.dataset.chartMode)return; mode = button.dataset.chartMode; draw(); }));
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) { visible=false;stop(); }
        else if (entry.intersectionRatio >= .2 && !visible) { visible=true;draw(); }
      });
    },{threshold:[0,.2]}) : null;
    observer?.observe(section); draw(false); controllers.push({stop,draw,observer});
  });
  motion.addEventListener('change',() => controllers.forEach(controller => controller.draw(false)));
  document.addEventListener('visibilitychange',() => { if(document.hidden)controllers.forEach(controller => controller.stop()); });
  window.addEventListener('pagehide',event => { controllers.forEach(controller => { controller.stop();if(!event.persisted)controller.observer?.disconnect(); }); });
})();
