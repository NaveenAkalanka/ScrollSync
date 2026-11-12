/* Live demos for guide.html: a working replica of the popup inside a frame, driven by a
   scripted cursor on a loop. Built in the page (not a video) so it stays sharp, follows the
   real Clay styling, and can be paused. Extension-page CSP blocks inline scripts, so this
   lives in its own file. */
(() => {
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const MARK = '<svg viewBox="0 0 1731.6 1731.6" fill="currentColor"><polygon points="865.9 1052.3 1137.6 1459.9 865.9 1731.6 594.2 1459.9 865.9 1052.3"/><polygon points="1386.6 1210.9 1258.4 1339 865.9 749.9 473.2 1339 345.1 1210.9 865.9 429.7 1386.6 1210.9"/><polygon points="1731.6 865.8 1507.5 1090 865.9 127.3 224.2 1090 0 865.8 865.9 0 1731.6 865.8"/></svg>';
  const CURSOR = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 2.5 19.5 13l-7 1.3 3.9 7.2-3 1.6-3.9-7.2L4 21z" fill="#3B2B35" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const ABORT = Symbol('restart');
  const ic = (n) => `<span class="icon">${n}</span>`;

  /* ── Popup replica ─────────────────────────────────────── */

  const sw = (ref) => `<span class="m-switch" data-ref="${ref}"><span></span></span>`;
  const row = (ref, title, hint) => `<div class="m-row"><span class="m-row-t"><b>${title}</b><small>${hint}</small></span>${sw(ref)}</div>`;
  const segs = (list) => `<div class="m-segs">${list.map(([ref, label, icon]) => `<span class="m-seg m-seg-sm" data-ref="${ref}">${icon ? ic(icon) : ''}${label}</span>`).join('')}</div>`;
  const slider = (ref, label, unit) => `<div class="m-slider"><div class="m-sl-head"><span>${label}</span><span class="m-well"><span data-ref="${ref}Val"></span><small>${unit}</small></span></div><span class="m-range" data-ref="${ref}"><span class="m-fill"></span><span class="m-thumb"></span></span></div>`;
  const key = (ref, label, icon) => `<span class="m-key" data-ref="${ref}">${ic(icon)}<span>${label}</span></span>`;

  const POPUP = `
    <div class="m-pop">
      <div class="m-head">
        <span class="m-mark" data-ref="mark">${MARK}</span>
        <span class="m-id"><b>ScrollSync</b><span class="m-status" data-ref="status"><i></i><span data-ref="statusText">Off</span></span></span>
        <span class="m-hub" data-ref="hub">${ic('radio_button_checked')}</span>
        ${sw('power')}
      </div>
      <div class="m-tabs">
        <span class="m-seg" data-ref="tab-scroll">${ic('swap_vert')}Scroll<i class="m-live"></i></span>
        <span class="m-seg" data-ref="tab-auto">${ic('touch_app')}Auto<i class="m-live"></i></span>
        <span class="m-seg" data-ref="tab-pad">${ic('stadia_controller')}Pad<i class="m-live"></i></span>
      </div>
      <div class="m-panels">
        <div class="m-panel" data-ref="panel-scroll">
          ${row('sMode', 'Auto-scroll', 'Moves the page at a steady speed')}
          ${segs([['sDown', 'Down', 'south'], ['sUp', 'Up', 'north']])}
          ${slider('sSpeed', 'Speed', 'px/s')}
        </div>
        <div class="m-panel" data-ref="panel-auto">
          ${row('aMode', 'Auto Pulse', 'Clicks the largest image on a timer')}
          ${segs([['aLeft', 'Left'], ['aCenter', 'Center'], ['aRight', 'Right']])}
          ${slider('aPos', 'Click position', '%')}
          ${slider('aInt', 'Interval', 's')}
        </div>
        <div class="m-panel" data-ref="panel-pad">
          ${row('pMode', 'Gamepad', 'Stick scrolls, A or RT clicks')}
          <div class="m-keys">${key('pV', 'Vertical', 'swap_vert')}${key('pH', 'Sideways', 'swap_horiz')}${key('pC', 'Click', 'ads_click')}</div>
          ${segs([['pLeft', 'Left stick'], ['pRight', 'Right stick']])}
          ${slider('pSens', 'Sensitivity', '×')}
        </div>
      </div>
      <div class="m-transport">
        <span class="m-btn" data-ref="back">${ic('keyboard_arrow_up')}</span>
        <span class="m-dome" data-ref="dome">${ic('pause')}</span>
        <span class="m-btn" data-ref="fwd">${ic('keyboard_arrow_down')}</span>
      </div>
    </div>`;

  // Mini web page used by the scroll and gamepad previews: two copies for a seamless loop.
  const pageCopy = () => `
    <div class="fx-copy">
      <span class="fx-h"></span><span class="fx-l"></span><span class="fx-l"></span><span class="fx-l s"></span>
      <span class="fx-img a"></span>
      <span class="fx-l"></span><span class="fx-l"></span><span class="fx-l s"></span>
      <span class="fx-img b"></span>
      <span class="fx-l"></span><span class="fx-l s"></span>
    </div>`;

  const FX = {
    scroll: `<div class="fx" data-ref="fx"><span class="fx-tag">Web page</span><div class="fx-page" data-ref="page">${pageCopy()}${pageCopy()}</div></div>`,
    auto: `<div class="fx fx-reader" data-ref="fx"><span class="fx-tag">Gallery</span>
             <div class="fx-art" data-ref="art"><span class="fx-art-n" data-ref="artN">1</span><span class="fx-ring" data-ref="ring"></span></div>
             <span class="fx-count" data-ref="count">Page 1</span></div>`,
    pad: `<div class="fx fx-pad" data-ref="fx"><span class="fx-tag">Web page</span>
            <div class="fx-page" data-ref="page">${pageCopy()}${pageCopy()}</div>
            <span class="fx-flash" data-ref="flash"></span>
            <div class="fx-ctrl">
              <span class="fx-stick" data-ref="stick"><span class="fx-knob" data-ref="knob"></span></span>
              <span class="fx-a" data-ref="aBtn">A</span>
            </div></div>`,
  };

  /* ── One demo ──────────────────────────────────────────── */

  class Demo {
    constructor(host) {
      this.host = host;
      this.kind = host.dataset.demo;
      this.steps = JSON.parse(host.dataset.steps);
      this.tips = {};
      this.userPaused = false;
      this.visible = false;

      host.innerHTML = `
        <div class="demo-stage" aria-hidden="true">
          ${POPUP}
          ${FX[this.kind]}
          <span class="demo-tip" data-ref="tip"></span>
          <span class="demo-cursor" data-ref="cursor">${CURSOR}<span class="demo-ripple"></span></span>
        </div>
        <div class="demo-foot">
          <ol class="demo-steps">${this.steps.map((s, i) => `<li><span class="n">${i + 1}</span>${s}</li>`).join('')}</ol>
          <button type="button" class="demo-toggle" aria-pressed="false"><span class="icon">pause</span><span class="lbl">Pause demo</span></button>
        </div>`;

      this.stage = host.querySelector('.demo-stage');
      this.r = {};
      host.querySelectorAll('[data-ref]').forEach((el) => { this.r[el.dataset.ref] = el; });
      this.stepEls = [...host.querySelectorAll('.demo-steps li')];
      this.toggle = host.querySelector('.demo-toggle');

      this.toggle.addEventListener('click', () => {
        this.userPaused = !this.userPaused;
        this.toggle.setAttribute('aria-pressed', String(this.userPaused));
        this.toggle.querySelector('.icon').textContent = this.userPaused ? 'play_arrow' : 'pause';
        this.toggle.querySelector('.lbl').textContent = this.userPaused ? 'Play demo' : 'Pause demo';
        host.classList.toggle('is-paused', this.userPaused);
      });

      // Entries can arrive batched after a fast scroll; only the newest one is current.
      // Coming back after a while away restarts the demo from step 1 instead of mid-way.
      new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        if (e.isIntersecting && !this.visible && this.hiddenAt && performance.now() - this.hiddenAt > 4000) this.restart = true;
        if (!e.isIntersecting && this.visible) this.hiddenAt = performance.now();
        this.visible = e.isIntersecting;
      }, { threshold: [0, 0.1] }).observe(host);

      this.reset();
      this.fitHeight();
      addEventListener('resize', () => this.fitHeight());
      if (document.fonts) document.fonts.ready.then(() => this.fitHeight());
      if (REDUCE) {
        this.toggle.hidden = true;
        this.finalState();
        this.render();
        return;
      }
      this.lastT = 0;
      requestAnimationFrame((t) => this.frame(t));
      this.loop();
    }

    // Each tab has its own panel height. Reserve the tallest so the page below never jumps.
    fitHeight() {
      const st = this.stage, tab = this.s.tab;
      st.style.minHeight = '';
      let max = 0;
      for (const t of ['scroll', 'auto', 'pad']) {
        this.s.tab = t; this.render();
        max = Math.max(max, st.offsetHeight);
      }
      this.s.tab = tab; this.render();
      st.style.minHeight = `${max}px`;
    }

    get paused() { return this.userPaused || !this.visible || document.hidden; }

    reset() {
      this.s = {
        on: false, paused: false, tab: { scroll: 'auto', auto: 'pad', pad: 'scroll' }[this.kind], mode: null,
        dir: 'down', speed: 120, pos: 50, interval: 5, pv: false, ph: false, pc: false, stick: 'left', sens: 15,
      };
      this.offset = 0; this.tilt = 0; this.pulseT = 0; this.page = 1;
      this.r.cursor.classList.remove('show', 'down');
      this.hideTip();
      this.setStep(-1);
      if (this.r.artN) { this.r.artN.textContent = '1'; this.r.count.textContent = 'Page 1'; this.r.art.dataset.page = '1'; }
      this.render();
    }

    // The settled picture shown when motion is reduced: the mode set up and running.
    finalState() {
      const s = this.s;
      s.on = true; s.tab = this.kind; s.mode = this.kind;
      if (this.kind === 'scroll') { s.speed = 240; }
      if (this.kind === 'auto') { s.pos = 90; s.interval = 2; }
      if (this.kind === 'pad') { s.pv = true; s.pc = true; }
    }

    /* ── State → replica ── */
    render() {
      const s = this.s, r = this.r;
      const running = s.on && !s.paused;
      this.stage.dataset.power = s.on ? 'on' : 'off';
      r.mark.classList.toggle('on', s.on);
      r.power.classList.toggle('on', s.on);
      r.sMode.classList.toggle('on', s.mode === 'scroll');
      r.aMode.classList.toggle('on', s.mode === 'auto');
      r.pMode.classList.toggle('on', s.mode === 'pad');

      let text = 'Off', tone = 'off';
      if (s.on && s.paused) { text = 'Paused'; tone = 'hold'; }
      else if (s.on) {
        tone = 'run';
        if (s.mode === 'scroll') text = `${s.dir === 'up' ? 'Up' : 'Down'} · ${s.speed} px/s`;
        else if (s.mode === 'auto') text = `Pulse every ${s.interval} s`;
        else if (s.mode === 'pad') text = 'Gamepad mode';
        else { text = 'On · pick a mode'; tone = 'idle'; }
      }
      r.statusText.textContent = text;
      r.status.dataset.tone = tone;

      for (const t of ['scroll', 'auto', 'pad']) {
        r[`tab-${t}`].classList.toggle('sel', s.tab === t);
        r[`tab-${t}`].classList.toggle('live', s.on && s.mode === t);
        r[`panel-${t}`].classList.toggle('show', s.tab === t);
      }
      r.sDown.classList.toggle('sel', s.dir === 'down');
      r.sUp.classList.toggle('sel', s.dir === 'up');
      r.aLeft.classList.toggle('sel', s.pos === 10);
      r.aCenter.classList.toggle('sel', s.pos === 50);
      r.aRight.classList.toggle('sel', s.pos === 90);
      r.pV.classList.toggle('sel', s.pv);
      r.pH.classList.toggle('sel', s.ph);
      r.pC.classList.toggle('sel', s.pc);
      r.pLeft.classList.toggle('sel', s.stick === 'left');
      r.pRight.classList.toggle('sel', s.stick === 'right');

      this.setRange('sSpeed', s.speed, 0, 500);
      this.setRange('aPos', s.pos, 0, 100);
      this.setRange('aInt', s.interval, 1, 60);
      this.setRange('pSens', s.sens, 1, 50);

      r.dome.dataset.state = !s.on ? 'off' : s.paused ? 'paused' : 'running';
      r.dome.querySelector('.icon').textContent = s.paused ? 'play_arrow' : 'pause';
      const nav = s.mode === 'auto';
      r.back.querySelector('.icon').textContent = nav ? 'chevron_left' : 'keyboard_arrow_up';
      r.fwd.querySelector('.icon').textContent = nav ? 'chevron_right' : 'keyboard_arrow_down';

      if (r.ring) {
        r.ring.style.left = `${s.pos}%`;
        r.ring.classList.toggle('show', s.on && s.mode === 'auto');
      }
      if (r.fx) r.fx.classList.toggle('live', running && s.mode === this.kind);
    }

    setRange(ref, v, min, max) {
      const pct = ((v - min) / (max - min)) * 100;
      this.r[ref].style.setProperty('--pct', `${pct}%`);
      this.r[`${ref}Val`].textContent = v;
    }

    setStep(i) {
      this.stepEls.forEach((li, k) => {
        li.classList.toggle('now', k === i);
        li.classList.toggle('done', k < i);
      });
    }

    /* ── Effects: run every frame while visible ── */
    frame(t) {
      requestAnimationFrame((n) => this.frame(n));
      const dt = this.lastT ? Math.min(0.05, (t - this.lastT) / 1000) : 0;
      this.lastT = t;
      try { if (!this.paused) this.tick(dt); } catch (err) { console.warn('[guide demo]', err); }
    }

    tick(dt) {
      const s = this.s;
      const running = s.on && !s.paused;
      if (this.kind === 'scroll') {
        const v = running && s.mode === 'scroll' ? s.speed * (s.dir === 'up' ? -1 : 1) : 0;
        this.scrollPage(v * 0.32 * dt);
      } else if (this.kind === 'pad') {
        const v = running && s.mode === 'pad' && s.pv ? this.tilt * 150 : 0;
        this.scrollPage(v * dt);
        this.r.knob.style.transform = `translate(-50%, calc(-50% + ${this.tilt * 13}px))`;
      } else if (this.kind === 'auto' && running && s.mode === 'auto') {
        this.pulseT += dt;
        if (this.pulseT >= s.interval) { this.pulseT = 0; this.pulse(); }
      }
    }

    scrollPage(dy) {
      const copy = this.r.page.firstElementChild.offsetHeight || 1;
      this.offset = (((this.offset + dy) % copy) + copy) % copy;
      this.r.page.style.transform = `translateY(${-this.offset}px)`;
    }

    pulse() {
      const { ring, art, artN, count } = this.r;
      ring.classList.remove('hit'); void ring.offsetWidth; ring.classList.add('hit');
      setTimeout(() => {
        this.page = this.page % 3 + 1;
        art.dataset.page = String(this.page);
        artN.textContent = String(this.page);
        count.textContent = `Page ${this.page}`;
      }, 260);
    }

    /* ── Cursor and timing ── */
    async sleep(ms) {
      let left = ms;
      while (left > 0) {
        await new Promise((res) => setTimeout(res, 40));
        if (this.restart) throw ABORT;
        if (!this.paused) left -= 40;
      }
    }

    point(el, fx = 0.5, fy = 0.5) {
      const a = el.getBoundingClientRect(), b = this.stage.getBoundingClientRect();
      return { x: a.left - b.left + a.width * fx, y: a.top - b.top + a.height * fy };
    }

    place({ x, y }, instant = false) {
      const c = this.r.cursor;
      c.classList.toggle('instant', instant);
      c.style.transform = `translate(${x}px, ${y}px)`;
    }

    showTip(el, text) {
      if (!text) return;
      const tip = this.r.tip;
      tip.textContent = text;
      const p = this.point(el, 0.5, 0);
      const w = this.stage.clientWidth;
      tip.style.left = '0px';
      tip.classList.add('show');
      const tw = tip.offsetWidth;
      const x = Math.max(6, Math.min(w - tw - 6, p.x - tw / 2));
      tip.style.left = `${x}px`;
      tip.style.top = `${p.y - tip.offsetHeight - 8}px`;
    }

    hideTip() { this.r.tip.classList.remove('show'); }

    async to(el, tip, fx, fy) {
      this.hideTip();
      this.place(this.point(el, fx, fy));
      await this.sleep(720);
      this.showTip(el, tip);
      await this.sleep(tip ? 650 : 120);
    }

    async click(apply) {
      const c = this.r.cursor;
      c.classList.add('down');
      await this.sleep(150);
      this.hideTip();
      if (apply) { apply(this.s); this.render(); }
      c.classList.remove('down');
      await this.sleep(450);
    }

    async press(el, tip, apply) { await this.to(el, tip); await this.click(apply); }

    // Drag a slider thumb from its current value to `to`.
    async drag(ref, key, to, min, max) {
      const track = this.r[ref];
      const at = (v) => this.point(track, (v - min) / (max - min), 0.5);
      await this.to(track.querySelector('.m-thumb'));
      this.r.cursor.classList.add('down');
      const from = this.s[key];
      const dur = 1000;
      let t = 0;
      while (t < dur) {
        await this.sleep(40);
        t += 40;
        const k = Math.min(1, t / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        this.s[key] = Math.round(from + (to - from) * e);
        this.render();
        this.place(at(this.s[key]), true);
      }
      this.r.cursor.classList.remove('down');
      await this.sleep(500);
    }

    async tiltStick(to, hold) {
      const knob = this.r.knob;
      await this.to(knob);
      this.r.cursor.classList.add('down');
      const from = this.tilt;
      for (let t = 0; t <= 400; t += 40) {
        this.tilt = from + (to - from) * (t / 400);
        this.place(this.point(knob), true);
        await this.sleep(40);
      }
      await this.sleep(hold);
      for (let t = 0; t <= 300; t += 40) {
        this.tilt = to * (1 - t / 300);
        this.place(this.point(knob), true);
        await this.sleep(40);
      }
      this.tilt = 0;
      this.r.cursor.classList.remove('down');
      await this.sleep(300);
    }

    /* ── The loop ── */
    async loop() {
      // Never let one bad frame end the loop: a restart or any error starts the next pass.
      for (;;) {
        this.restart = false;
        try {
          this.reset();
          this.place({ x: this.stage.clientWidth * 0.62, y: this.stage.clientHeight + 30 }, true);
          await this.sleep(500);
          this.r.cursor.classList.add('show');
          await this.script();
          await this.sleep(1800);
          this.setStep(this.steps.length);
          this.r.cursor.classList.remove('show');
          this.hideTip();
          await this.sleep(900);
        } catch (err) {
          if (err !== ABORT) {
            console.warn('[guide demo]', err);
            await new Promise((res) => setTimeout(res, 1000));
          }
          this.tilt = 0;
          this.r.cursor.classList.remove('down', 'show');
        }
      }
    }

    async step(i) { this.setStep(i); await this.sleep(250); }

    async script() {
      const r = this.r;
      const autoOn = (mode) => (s) => { s.mode = mode; s.on = true; s.paused = false; };
      if (this.kind === 'scroll') {
        await this.step(0); await this.press(r['tab-scroll'], 'Auto-scroll settings: speed and direction', (s) => { s.tab = 'scroll'; });
        await this.step(1); await this.press(r.sMode, 'Start auto-scrolling. Other modes switch off.', autoOn('scroll'));
        await this.sleep(1200);
        await this.step(2); await this.press(r.sUp, 'Scroll up the page (A key)', (s) => { s.dir = 'up'; });
        await this.sleep(1200);
        await this.press(r.sDown, 'Scroll down the page (D key)', (s) => { s.dir = 'down'; });
        await this.step(3); await this.drag('sSpeed', 'speed', 240, 0, 500);
        await this.sleep(1400);
        await this.step(4); await this.press(r.dome, 'Pause (Space)', (s) => { s.paused = true; });
        await this.sleep(1400);
        await this.press(r.dome, 'Resume (Space)', (s) => { s.paused = false; });
      } else if (this.kind === 'auto') {
        await this.step(0); await this.press(r['tab-auto'], 'Auto Pulse settings: clicks an image on a timer', (s) => { s.tab = 'auto'; });
        await this.step(1); await this.press(r.aMode, 'Start clicking on a timer. Other modes switch off.', autoOn('auto'));
        await this.step(2); await this.press(r.aRight, 'Click the right side of the image (D key)', (s) => { s.pos = 90; });
        await this.step(3); await this.drag('aInt', 'interval', 2, 1, 60);
        this.pulseT = 1.4;
        await this.sleep(4600);
        await this.step(4); await this.press(r.dome, 'Pause (Space)', (s) => { s.paused = true; });
        await this.sleep(1400);
        await this.press(r.dome, 'Resume (Space)', (s) => { s.paused = false; });
      } else {
        await this.step(0); await this.press(r['tab-pad'], 'Gamepad settings: scroll and click with a controller', (s) => { s.tab = 'pad'; });
        await this.step(1); await this.press(r.pMode, 'Control the page with a gamepad. Other modes switch off.', autoOn('pad'));
        await this.step(2); await this.press(r.pV, 'Stick up and down scrolls the page', (s) => { s.pv = true; });
        await this.press(r.pC, 'A or right trigger clicks the image', (s) => { s.pc = true; });
        await this.step(3); await this.tiltStick(1, 1500); await this.tiltStick(-0.7, 1000);
        await this.step(4); await this.to(r.aBtn);
        await this.click(() => {
          r.aBtn.classList.add('down'); r.flash.classList.remove('hit'); void r.flash.offsetWidth; r.flash.classList.add('hit');
          setTimeout(() => r.aBtn.classList.remove('down'), 260);
        });
      }
    }
  }

  document.querySelectorAll('[data-demo]').forEach((el) => new Demo(el));
})();
