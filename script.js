(() => {
  const pairs = [
    { name: '外显小图', before: '外壳.png', after: '外壳-1.png' },
    { name: '头图', before: '左.png', after: '右.png' },
    { name: '门店相册', before: 'Frame 2147242661.png', after: 'Frame 2147242662.png' },
    { name: '推荐菜', before: 'Frame 2147242660.png', after: 'Frame 2147240232.png' },
  ];
  const slider = document.querySelector('.comparison');
  let scene = document.querySelector('.scene');
  let before = scene.querySelector('.before');
  let after = scene.querySelector('.after');
  let transition = null;
  const space = document.querySelector('.modal-space');
  const modal = document.querySelector('.modal');
  const reopen = document.querySelector('.reopen');
  const tablist = document.querySelector('.comparison-tabs');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const params = new URLSearchParams(location.search);
  let index = Math.max(0, Math.min(3, Number(params.get('slide')) || 0));
  let split = 100, frame, start = null, manualUntil = 0, dragging = false, closed = false;
  let loaded = false;
  const HOLD_BEFORE = 750, SWEEP = 2400, HOLD_AFTER = 1350, SLIDE = 540;
  const imageUrl = name => 'assets/' + encodeURIComponent(name);
  const assets = pairs.flatMap(pair => [pair.before, pair.after]).map(name => {
    const img = new Image(); img.src = imageUrl(name);
    return img.decode().catch(() => { loaded = false; });
  });
  function position(value) {
    split = Math.max(0, Math.min(100, value));
    slider.style.setProperty('--split', split + '%');
    const shown = Math.round(100 - split);
    slider.setAttribute('aria-valuenow', shown);
    slider.setAttribute('aria-valuetext', `有内容区域 ${shown}%`);
  }
  function showPair(next) {
    index = next;
    const pair = pairs[index];
    before.src = imageUrl(pair.before); after.src = imageUrl(pair.after);
    before.alt = `补充前，门店缺少${pair.name}`;
    after.alt = `补充后，展示完整的${pair.name}`;
    slider.setAttribute('aria-label', `${pair.name}：拖动查看补充内容前后对比`);
    slider.dataset.slide = index;
    syncTabs(index);
  }
  function syncTabs(selected) {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === selected));
      tab.tabIndex = i === selected ? 0 : -1;
    });
    tablist.style.setProperty('--tab-left', [0, 72, 120, 168][selected] + 'px');
    tablist.style.setProperty('--tab-width', [72, 48, 48, 60][selected] + 'px');
  }
  function settleTransition() {
    if (!transition) return;
    const job = transition;
    transition = null;
    scene.remove();
    scene = job.incoming;
    scene.removeAttribute('aria-hidden');
    scene.style.removeProperty('--split');
    before = scene.querySelector('.before');
    after = scene.querySelector('.after');
    job.animations.forEach(animation => animation.cancel());
    showPair(job.next);
    position(100);
    start = null;
  }
  function transitionTo(next, direction = 1) {
    settleTransition();
    if (next === index || reduceMotion.matches || params.has('still')) {
      showPair(next);
      position(params.has('still') || reduceMotion.matches ? 50 : 100);
      start = null;
      return;
    }
    const incoming = scene.cloneNode(true);
    incoming.setAttribute('aria-hidden', 'true');
    incoming.style.setProperty('--split', '100%');
    incoming.querySelector('.before').src = imageUrl(pairs[next].before);
    incoming.querySelector('.after').src = imageUrl(pairs[next].after);
    slider.append(incoming);
    const options = { duration: SLIDE, easing: 'cubic-bezier(.22,.75,.2,1)', fill: 'forwards' };
    const animations = [
      scene.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-direction * 100}%)` }], options),
      incoming.animate([{ transform: `translateX(${direction * 100}%)` }, { transform: 'translateX(0)' }], options),
    ];
    const job = { incoming, animations, next };
    transition = job;
    syncTabs(next);
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (transition === job) settleTransition();
    }).catch(() => {});
  }
  function selectTab(next) {
    settleTransition();
    manualUntil = 0;
    transitionTo(next, next < index ? -1 : 1);
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(i));
    tab.addEventListener('keydown', e => {
      const target = { ArrowLeft: (i + 3) % 4, ArrowRight: (i + 1) % 4, Home: 0, End: 3 }[e.key];
      if (target === undefined) return;
      e.preventDefault(); selectTab(target); tabs[target].focus();
    });
  });
  function tick(now) {
    if (closed) return;
    frame = requestAnimationFrame(tick);
    if (transition || !loaded || document.hidden || dragging || now < manualUntil || reduceMotion.matches || params.has('still')) { start = null; return; }
    if (start === null) start = now;
    const t = now - start;
    if (t < HOLD_BEFORE) position(100);
    else if (t < HOLD_BEFORE + SWEEP) {
      const p = (t - HOLD_BEFORE) / SWEEP;
      // Symmetric ease-in/out: the reveal itself always moves from right to left.
      const eased = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      position(100 * (1 - eased));
    } else if (t < HOLD_BEFORE + SWEEP + HOLD_AFTER) position(0);
    else transitionTo((index + 1) % pairs.length);
  }
  function pointerPosition(e) {
    const rect = slider.getBoundingClientRect();
    position((e.clientX - rect.left) / rect.width * 100);
  }
  slider.addEventListener('pointerdown', e => {
    settleTransition();
    dragging = true; slider.setPointerCapture(e.pointerId);
    pointerPosition(e);
  });
  slider.addEventListener('pointermove', e => { if (dragging) pointerPosition(e); });
  const release = () => { dragging = false; manualUntil = performance.now() + 4000; start = null; };
  slider.addEventListener('pointerup', release);
  slider.addEventListener('pointercancel', release);
  slider.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) settleTransition();
    const values = { ArrowLeft: split - 5, ArrowRight: split + 5, Home: 100, End: 0 };
    if (e.key in values) {
      e.preventDefault();
      position(values[e.key]); manualUntil = performance.now() + 6000; start = null;
    }
  });
  function close() {
    settleTransition();
    closed = true; cancelAnimationFrame(frame);
    space.hidden = true; reopen.hidden = false; reopen.focus();
  }
  document.querySelector('.close').addEventListener('click', close);
  document.querySelector('.primary').addEventListener('click', () => {
    modal.dispatchEvent(new CustomEvent('ai-assist', { bubbles: true }));
    close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !closed) close();
    if (e.key === 'Tab' && !closed) {
      const focusable = [...modal.querySelectorAll('button:not([tabindex="-1"]), [role="slider"]')];
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  });
  reopen.addEventListener('click', () => {
    closed = false; space.hidden = false; reopen.hidden = true;
    start = null; showPair(0); position(100); frame = requestAnimationFrame(tick);
    document.querySelector('.close').focus({ preventScroll: true });
  });
  function resize() {
    const scale = Math.min(1, innerWidth / 375, innerHeight / 571);
    space.style.width = 375 * scale + 'px'; space.style.height = 571 * scale + 'px';
    modal.style.transform = `scale(${scale})`;
  }
  addEventListener('resize', resize); resize(); showPair(index);
  Promise.all(assets).then(() => {
    loaded = true;
    position(params.has('still') ? Number(params.get('split') ?? 50) : reduceMotion.matches ? 50 : 100);
    frame = requestAnimationFrame(tick);
  });
})();
