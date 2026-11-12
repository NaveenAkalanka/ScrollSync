// One live ScrollSync per page. A copy injected later (after an extension reload, or by the
// popup's ensureContentScript) tells any older copy to retire, and clears hubs left behind by
// builds that predate this handshake. The DOM event reaches every isolated world on the page.
document.dispatchEvent(new CustomEvent('scrollsync:takeover'));
document.querySelectorAll('#scrollsync-root').forEach((n) => n.remove());
let retired = false;

let animationId = null;
let clickIntervalId = null;
let lastTimestamp = 0;
let isEnabled = false;
let currentSettings = {
  isPaused: false,
  isFloating: false,
  scrollV: { active: false, speed: 0 },
  nav: { active: false, position: 'right', posX: 90, interval: 5000 },
  pad: { active: false, vActive: false, hActive: false, clickActive: false, stick: 'left', sensitivity: 15 }
};

let lastButtonState = false;
let stickClickThresholdReached = false; 

// Create a persistent Shadow Root for all UI elements
const shadowHost = document.createElement('div');
shadowHost.id = 'scrollsync-root';
shadowHost.style.cssText = 'position: fixed; z-index: 2147483647; pointer-events: none; top: 0; left: 0; width: 100%; height: 100%;';
const shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

// Fonts for the on-page UI, self-hosted in the extension (public/fonts, web-accessible).
// Chrome ignores @font-face declared inside a shadow root, so the faces are registered on the
// page once, only when UI is first shown, under ScrollSync-prefixed names that cannot clash
// with the page's own fonts.
function ensureFonts() {
    const base = chrome.runtime.getURL('');
    const existing = document.getElementById('scrollsync-fonts');
    if (existing && existing.dataset.base === base) return;
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = 'scrollsync-fonts';
    style.dataset.base = base;
    style.textContent = `
        @font-face { font-family: 'ScrollSync Manrope'; font-style: normal; font-weight: 500 800; font-display: swap;
            src: url('${chrome.runtime.getURL('fonts/manrope-latin.woff2')}') format('woff2'); }
        @font-face { font-family: 'ScrollSync Symbols'; font-style: normal; font-weight: 500; font-display: block;
            src: url('${chrome.runtime.getURL('fonts/material-symbols-rounded-subset.woff2')}') format('woff2'); }
    `;
    (document.head || document.documentElement).appendChild(style);
}

// Global Styles for Shadow DOM
const styleTag = document.createElement('style');
// Clay palette, mirrored from src/index.css. The page underneath can be any colour, so the
// paired light/dark clay shadows only appear on clay ground (inside the hub's collar).
// Pieces that sit directly on the page get an offset dark drop plus a thin clay rim instead,
// which reads on light and dark pages alike.
const CLAY = {
    ground: '#ECE7EA', ink: '#3B2B35', ink2: '#6E5C66', ink3: '#9A8A93',
    accentInk: '#C8174A', run: '#0F7050', hold: '#8F4C00',
    // On clay ground (the puck inside its collar)
    raise: '3px 3px 6px rgba(150,118,136,0.5), -3px -3px 6px rgba(255,255,255,0.95)',
    press: 'inset 3px 3px 6px rgba(150,118,136,0.55), inset -3px -3px 6px rgba(255,255,255,0.95)',
    // On the host page (collar, menu buttons, toast)
    float: '0 6px 16px rgba(40,24,34,0.32), 0 1px 3px rgba(40,24,34,0.2), inset 1px 1px 0 rgba(255,255,255,0.85), inset -1px -1px 0 rgba(150,118,136,0.3)',
    floatPress: 'inset 2px 2px 5px rgba(150,118,136,0.55), inset -2px -2px 4px rgba(255,255,255,0.9), 0 3px 8px rgba(40,24,34,0.25)'
};
styleTag.textContent = `
    .icon {
        font-family: 'ScrollSync Symbols', 'Material Symbols Rounded';
        font-weight: normal; font-style: normal;
        font-size: 22px; line-height: 1; letter-spacing: normal;
        text-transform: none; white-space: nowrap; direction: ltr;
        display: inline-block;
        font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24;
        -webkit-font-feature-settings: 'liga';
        -webkit-font-smoothing: antialiased;
    }
    .clay {
        background: ${CLAY.ground};
        color: ${CLAY.ink2};
        box-shadow: ${CLAY.float};
    }
    .clay-menu-btn { transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s, box-shadow 0.2s, color 0.2s; }
    .clay-menu-btn:hover { color: ${CLAY.ink}; }
    .clay-menu-btn:active { box-shadow: ${CLAY.floatPress}; }
    @keyframes ss-sink {
        0% { box-shadow: ${CLAY.raise}; }
        55% { box-shadow: inset 5px 5px 10px rgba(150,118,136,0.6), inset -4px -4px 8px rgba(255,255,255,0.95); }
        100% { box-shadow: ${CLAY.press}; }
    }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition-duration: 0.01ms !important; } }
    /* Windows High Contrast drops box-shadows, which are the only edges clay has. */
    @media (forced-colors: active) {
        #scrollsync-floating-container, .clay, #scrollsync-status-toast { outline: 2px solid CanvasText; }
    }
`;
shadowRoot.appendChild(styleTag);

// Safety wrapper for extension communication
function safeSendMessage(message, callback) {
    try {
        if (!chrome.runtime?.id) {
            handleInvalidContext();
            return;
        }
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                if (chrome.runtime.lastError.message.includes("context invalidated")) {
                    handleInvalidContext();
                }
                return;
            }
            if (callback) callback(response);
        });
    } catch (e) {
        handleInvalidContext();
    }
}

function handleInvalidContext() {
    isEnabled = false;
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    if (clickIntervalId) { clearInterval(clickIntervalId); clickIntervalId = null; }
    if (clickIndicatorTickId) { clearInterval(clickIndicatorTickId); clickIndicatorTickId = null; }
    clickIndicatorEl = null;
    if (floatingIcon) {
        floatingIcon.remove();
        floatingIcon = null;
    }
    if (shadowHost.parentNode) shadowHost.remove();
    console.warn("[ScrollSync] Extension context invalidated. Script execution stopped. Please refresh the page.");
}

function getScrollableElement(axis = 'vertical') {
  if (!isEnabled) return null;
  const isVertical = axis === 'vertical';
  const scroller = document.scrollingElement || document.documentElement;
  const scrollSize = isVertical ? scroller.scrollHeight : scroller.scrollWidth;
  const clientSize = isVertical ? window.innerHeight : window.innerWidth;
  if (scrollSize > clientSize + 5) return window;
  const elements = document.querySelectorAll('*');
  let bestElem = null;
  let maxOverflow = 0;
  for (const el of elements) {
    const sSize = isVertical ? el.scrollHeight : el.scrollWidth;
    const cSize = isVertical ? el.clientHeight : el.clientWidth;
    const overflow = sSize - cSize;
    if (overflow < 20) continue;
    const style = window.getComputedStyle(el);
    const overflowStyle = isVertical ? style.overflowY : style.overflowX;
    if (overflowStyle === 'visible') continue;
    if (overflow > maxOverflow) { maxOverflow = overflow; bestElem = el; }
  }
  return bestElem;
}

function tryAxisScroll(axis, move) {
  const target = getScrollableElement(axis);
  if (!target) return false;
  const isV = axis === 'vertical';
  const readPos = () => target === window
    ? (isV ? window.scrollY : window.scrollX)
    : (isV ? target.scrollTop : target.scrollLeft);
  const before = readPos();
  if (target === window) {
    if (isV) window.scrollBy(0, move);
    else window.scrollBy(move, 0);
  } else {
    if (isV) target.scrollTop += move;
    else target.scrollLeft += move;
  }
  return Math.abs(readPos() - before) > 0.01;
}

function tryLibraryScroll(move) {
  if (!document.documentElement.dataset.scrollsyncLib) return false;
  document.dispatchEvent(new CustomEvent('__scrollsync_drive', { detail: { move } }));
  return true;
}

function dispatchWheelScroll(move) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const target = document.elementFromPoint(cx, cy) || document.body || document.documentElement;
  if (!target) return;
  target.dispatchEvent(new WheelEvent('wheel', {
    deltaX: 0,
    deltaY: move,
    deltaMode: 0,
    clientX: cx,
    clientY: cy,
    bubbles: true,
    cancelable: true,
    composed: true,
  }));
}

function showVisualFeedback(x, y) {
    if (!isEnabled) return;
    const dot = document.createElement('div');
    dot.style.cssText = `position: fixed; left: ${x - 5}px; top: ${y - 5}px; width: 10px; height: 10px; background: #FF2A5F; border: 2px solid #ECE7EA; box-sizing: border-box; border-radius: 50%; z-index: 1000000; pointer-events: none; transition: transform 0.4s, opacity 0.4s; box-shadow: 1px 2px 4px rgba(20,10,16,0.45);`;
    shadowRoot.appendChild(dot);
    setTimeout(() => { dot.style.transform = 'scale(4)'; dot.style.opacity = '0'; setTimeout(() => dot.remove(), 400); }, 10);
}

function findBestVisibleImage() {
  const images = document.querySelectorAll('img, canvas, [role="img"]');
  let best = null;
  let maxArea = 0;
  for (const img of images) {
    const rect = img.getBoundingClientRect();
    const visW = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const visH = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    if (visW < 10 || visH < 10) continue;
    const area = visW * visH;
    if (area > maxArea) { maxArea = area; best = img; }
  }
  return best;
}

function computeClickPoint(overridePosX = null) {
  const posX = overridePosX !== null && overridePosX !== undefined
    ? overridePosX
    : (typeof currentSettings.nav.posX === 'number' ? currentSettings.nav.posX : 90);
  const target = findBestVisibleImage();
  let x, y;
  if (target) {
    const rect = target.getBoundingClientRect();
    x = rect.left + rect.width * (posX / 100);
    y = rect.top + rect.height / 2;
  } else {
    x = window.innerWidth * (posX / 100);
    y = window.innerHeight / 2;
  }
  x = Math.max(0, Math.min(window.innerWidth - 1, x));
  y = Math.max(0, Math.min(window.innerHeight - 1, y));
  return { x, y, target };
}

function simulateSmartClick(forcedPosX = null) {
  if (!isEnabled || currentSettings.isPaused) return;
  const point = computeClickPoint(forcedPosX);
  const clickTarget = document.elementFromPoint(point.x, point.y) || point.target;
  if (clickTarget) {
    showVisualFeedback(point.x, point.y);
    const eventProps = { view: window, bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, buttons: 1 };
    clickTarget.dispatchEvent(new PointerEvent('pointerdown', eventProps));
    clickTarget.dispatchEvent(new MouseEvent('mousedown', eventProps));
    clickTarget.dispatchEvent(new PointerEvent('pointerup', eventProps));
    clickTarget.dispatchEvent(new MouseEvent('mouseup', eventProps));
    clickTarget.dispatchEvent(new MouseEvent('click', eventProps));
  }
}

let clickIndicatorEl = null;
let clickIndicatorTickId = null;

function ensureClickIndicator() {
  if (clickIndicatorEl) return clickIndicatorEl;
  clickIndicatorEl = document.createElement('div');
  clickIndicatorEl.id = 'scrollsync-click-indicator';
  clickIndicatorEl.style.cssText = `
    position: fixed; width: 28px; height: 28px;
    border: 3px solid #FF2A5F; border-radius: 50%; box-sizing: border-box;
    pointer-events: none; z-index: 2147483640;
    transform: translate(-50%, -50%);
    box-shadow: 1px 2px 3px rgba(20,10,16,0.45), inset 1px 2px 3px rgba(20,10,16,0.35);
    outline: 1px solid rgba(236,231,234,0.85); outline-offset: 0;
    display: none; opacity: 0.95;
    transition: left 0.15s ease-out, top 0.15s ease-out, opacity 0.3s;
  `;
  const dot = document.createElement('div');
  dot.style.cssText = 'position:absolute; top:50%; left:50%; width:4px; height:4px; background:#FF2A5F; border-radius:50%; transform:translate(-50%,-50%); box-shadow:1px 1px 2px rgba(20,10,16,0.5);';
  clickIndicatorEl.appendChild(dot);
  if (!shadowHost.parentNode) document.body.appendChild(shadowHost);
  shadowRoot.appendChild(clickIndicatorEl);
  return clickIndicatorEl;
}

function updateClickIndicator() {
  const shouldShow = isEnabled && currentSettings.nav.active && !currentSettings.isPaused;
  if (!shouldShow) {
    if (clickIndicatorEl) clickIndicatorEl.style.display = 'none';
    if (clickIndicatorTickId) { clearInterval(clickIndicatorTickId); clickIndicatorTickId = null; }
    return;
  }
  const ind = ensureClickIndicator();
  const point = computeClickPoint();
  ind.style.display = 'block';
  ind.style.left = `${point.x}px`;
  ind.style.top = `${point.y}px`;
  if (!clickIndicatorTickId) {
    clickIndicatorTickId = setInterval(() => {
      if (!isEnabled || !currentSettings.nav.active || currentSettings.isPaused) {
        clearInterval(clickIndicatorTickId); clickIndicatorTickId = null;
        if (clickIndicatorEl) clickIndicatorEl.style.display = 'none';
        return;
      }
      const p = computeClickPoint();
      ind.style.left = `${p.x}px`;
      ind.style.top = `${p.y}px`;
    }, 500);
  }
}

function pollGamepad() {
  if (!isEnabled) return { v: 0, h: 0 };
  const pad = Array.from(navigator.getGamepads()).find(p => p !== null);
  if (!pad) return { v: 0, h: 0 };
  const isLeft = currentSettings.pad.stick === 'left';
  const rawH = (isLeft ? pad.axes[0] : pad.axes[2]) || 0;
  const rawV = (isLeft ? pad.axes[1] : pad.axes[3]) || 0;
  const h = Math.abs(rawH) > 0.1 ? rawH : 0;
  const v = Math.abs(rawV) > 0.1 ? rawV : 0;
  if (currentSettings.pad.clickActive) {
    const isPressed = !!(pad.buttons[0]?.pressed) || !!(pad.buttons[7]?.pressed);
    if (isPressed && !lastButtonState) simulateSmartClick();
    lastButtonState = isPressed;
    if (Math.abs(h) > 0.9) { if (!stickClickThresholdReached) { simulateSmartClick(h > 0 ? 90 : 10); stickClickThresholdReached = true; } }
    else { stickClickThresholdReached = false; }
  }
  return { v: currentSettings.pad.vActive ? v : 0, h: currentSettings.pad.hActive ? h : 0 };
}

function startMainLoop() {
  if (animationId) return;
  const step = (timestamp) => {
    if (!lastTimestamp) { lastTimestamp = timestamp; animationId = requestAnimationFrame(step); return; }
    const elapsed = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    if (elapsed > 0 && isEnabled && !currentSettings.isPaused) {
      const elapsedSec = Math.min(elapsed / 1000, 0.1);
      if (currentSettings.scrollV.active && currentSettings.scrollV.speed !== 0) {
        const move = currentSettings.scrollV.speed * elapsedSec;
        let moved = tryAxisScroll('vertical', move);
        if (!moved) moved = tryAxisScroll('horizontal', move);
        if (!moved) moved = tryLibraryScroll(move);
        if (!moved) dispatchWheelScroll(move);
      }
      if (currentSettings.pad.active) {
        const padInput = pollGamepad();
        if (padInput.v !== 0) {
          const target = getScrollableElement('vertical');
          const move = padInput.v * currentSettings.pad.sensitivity;
          if (target === window) window.scrollBy(0, move);
          else target.scrollTop += move;
        }
        if (padInput.h !== 0) {
          const target = getScrollableElement('horizontal');
          const move = padInput.h * currentSettings.pad.sensitivity;
          if (target === window) window.scrollBy(move, 0);
          else target.scrollLeft += move;
        }
      }
    }
    animationId = requestAnimationFrame(step);
  };
  animationId = requestAnimationFrame(step);
}

let _lastClickConfig = { active: false, interval: 0 };

function manageClickInterval() {
    const wantActive = isEnabled && currentSettings.nav.active && !currentSettings.isPaused;
    const newInterval = currentSettings.nav.interval;
    const unchanged = wantActive === _lastClickConfig.active && newInterval === _lastClickConfig.interval;
    if (!unchanged) {
        if (clickIntervalId) { clearInterval(clickIntervalId); clickIntervalId = null; }
        if (wantActive) {
            clickIntervalId = setInterval(simulateSmartClick, newInterval);
        }
        _lastClickConfig = { active: wantActive, interval: newInterval };
    }
    updateClickIndicator();
}

function handleManualNav(direction) {
    if (!isEnabled) return;
    if (currentSettings.nav.active) {
        const newPosX = direction === 'back' ? 10 : 90;
        currentSettings.nav.posX = newPosX;
        safeSendMessage({ action: "updateSettingsUI", settings: { navPosX: newPosX } });
        showStatusToast(`Click point ${newPosX}%`);
        updateClickIndicator();
    } else if (currentSettings.scrollV.active) {
        const speed = Math.abs(currentSettings.scrollV.speed) || 40;
        currentSettings.scrollV.speed = direction === 'back' ? -speed : speed;
        safeSendMessage({ action: "updateSettingsUI", settings: { vSpeed: currentSettings.scrollV.speed } });
        showStatusToast(direction === 'back' ? 'Scrolling up' : 'Scrolling down');
    }
    if (floatingIcon) floatingIcon.updateIcon();
}

let floatingIcon = null;
const SVG_NS = 'http://www.w3.org/2000/svg';
const MARK_POINTS = [
    '865.9 1052.3 1137.6 1459.9 865.9 1731.6 594.2 1459.9 865.9 1052.3',
    '1386.6 1210.9 1258.4 1339 865.9 749.9 473.2 1339 345.1 1210.9 865.9 429.7 1386.6 1210.9',
    '1731.6 865.8 1507.5 1090 865.9 127.3 224.2 1090 0 865.8 865.9 0 1731.6 865.8',
];

class FloatingIcon {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'scrollsync-floating-container';
        this._dragging = false;
        this.isDragging = false;
        this.dragged = false;
        this.isExpanded = false;
        this.startX = 0; this.startY = 0;
        this.posX = window.innerWidth - 100;
        this.posY = window.innerHeight - 150;
        this.menuButtons = [];
        this.init();
    }

    init() {
        this.container.style.cssText = `
            position: fixed; left: ${this.posX}px; top: ${this.posY}px;
            width: 64px; height: 64px; border-radius: 50%;
            background: ${CLAY.ground}; box-shadow: ${CLAY.float};
            display: flex; align-items: center; justify-content: center;
            cursor: move; z-index: 2147483647; touch-action: none; -webkit-touch-callout: none;
            user-select: none; -webkit-user-select: none; transition: transform 0.2s; pointer-events: auto;
        `;

        // The collar above is the hub's own clay ground; the puck below presses into it.
        this.anchor = document.createElement('div');
        this.anchor.title = 'ScrollSync: click for controls, right-click for quick actions, drag to move';
        this.anchor.style.cssText = `
            width: 46px; height: 46px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            background: ${CLAY.ground}; box-shadow: ${CLAY.raise};
            transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s;
            z-index: 2;
        `;
        this.container.appendChild(this.anchor);

        // The ScrollSync mark (icon.svg geometry). Its colour carries state with the puck's depth.
        this.anchorIcon = document.createElementNS(SVG_NS, 'svg');
        this.anchorIcon.setAttribute('viewBox', '0 0 1731.6 1731.6');
        this.anchorIcon.setAttribute('aria-hidden', 'true');
        this.anchorIcon.style.cssText = `width: 22px; height: 22px; color: ${CLAY.ink2}; fill: currentColor; transition: color 0.2s; margin-top: 2px;`;
        MARK_POINTS.forEach((pts) => {
            const poly = document.createElementNS(SVG_NS, 'polygon');
            poly.setAttribute('points', pts);
            this.anchorIcon.appendChild(poly);
        });
        this.anchor.appendChild(this.anchorIcon);
        // Small state glyph tucked under the mark: pause while paused, nothing otherwise.
        this.anchorBadge = document.createElement('span');
        this.anchorBadge.className = 'icon';
        this.anchorBadge.style.cssText = `position: absolute; right: 5px; bottom: 5px; width: 18px; height: 18px; border-radius: 50%; display: none; align-items: center; justify-content: center; font-size: 13px; color: #fff; background: ${CLAY.hold}; box-shadow: 0 1px 3px rgba(40,24,34,0.35); z-index: 3;`;
        this.anchorBadge.textContent = 'pause';
        this.container.appendChild(this.anchorBadge);

        this.menu = document.createElement('div');
        this.menu.style.cssText = `position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none; z-index: 1;`;
        this.container.appendChild(this.menu);

        this.updateIcon();
        // Pointer events cover mouse, touch and pen on every platform. Touch has no right-click,
        // so a long press opens the quick actions; the touch browser's own long-press menu is suppressed.
        this.container.addEventListener('pointerdown', (e) => this.onDragStart(e));
        this.container.addEventListener('click', (e) => this.onClick(e));
        this.container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this._touchAt && performance.now() - this._touchAt < 1200) return;
            if (!this.dragged) this.toggleMenu();
        });
        
        ensureFonts(); if (!shadowHost.parentNode) document.body.appendChild(shadowHost);
        shadowRoot.appendChild(this.container);

        this._onDrag = (e) => this.onDrag(e);
        this._onDragEnd = () => this.onDragEnd();
        window.addEventListener('pointermove', this._onDrag);
        window.addEventListener('pointerup', this._onDragEnd);
        window.addEventListener('pointercancel', this._onDragEnd);
        this.createMenu();
    }

    createMenu() {
        const actions = [
            { id: 'pause', icon: 'pause', label: 'Pause or resume', action: () => this.togglePause() },
            { id: 'power', icon: 'power_settings_new', label: 'Turn ScrollSync on or off', action: () => this.toggleEnable() },
            { id: 'settings', icon: 'tune', label: 'Open controls', action: () => toggleOverlayPanel() }
        ];
        actions.forEach((item, index) => {
            const btn = document.createElement('div');
            btn.className = 'clay clay-menu-btn';
            btn.title = item.label;
            btn.setAttribute('role', 'button');
            btn.setAttribute('aria-label', item.label);
            btn.style.cssText = `position: absolute; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; pointer-events: auto; transform: scale(0); opacity: 0; top: 13px; left: 13px;`;

            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.style.fontSize = '20px';
            icon.textContent = item.icon;
            btn.appendChild(icon);

            btn.addEventListener('click', (e) => { e.stopPropagation(); item.action(); });
            this.menu.appendChild(btn);
            this.menuButtons.push({ el: btn, iconEl: icon, angle: (index * 90) - 180, baseIcon: item.icon });
        });
    }

    toggleMenu() {
        this.isExpanded = !this.isExpanded;
        this.menuButtons.forEach((btn) => {
            if (this.isExpanded) {
                const dist = 60;
                const x = Math.cos(btn.angle * Math.PI / 180) * dist;
                const y = Math.sin(btn.angle * Math.PI / 180) * dist;
                btn.el.style.transform = `translate(${x}px, ${y}px) scale(1)`;
                btn.el.style.opacity = '1';
            } else {
                btn.el.style.transform = `translate(0, 0) scale(0)`;
                btn.el.style.opacity = '0';
            }
        });
        this.anchor.style.transform = this.isExpanded ? 'scale(0.92)' : 'scale(1)';
    }

    // Depth is state: the puck is pressed in while something is running, raised otherwise.
    updateIcon() {
        const s = currentSettings;
        if (!isEnabled) {
            this.anchor.style.boxShadow = CLAY.raise;
            this.anchorIcon.style.color = CLAY.ink2;
            this.anchorBadge.style.display = 'none';
        } else if (s.isPaused) {
            this.anchor.style.boxShadow = CLAY.raise;
            this.anchorIcon.style.color = CLAY.hold;
            this.anchorBadge.style.display = 'flex';
        } else {
            this.anchor.style.boxShadow = CLAY.press;
            if (!this._running) this.anchor.style.animation = 'ss-sink 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
            this.anchorIcon.style.color = CLAY.accentInk;
            this.anchorBadge.style.display = 'none';
        }
        const mode = s.scrollV && s.scrollV.active ? 'auto-scroll' : s.nav && s.nav.active ? 'Auto Pulse' : s.pad && s.pad.active ? 'gamepad' : 'no mode';
        this.anchor.title = `ScrollSync ${!isEnabled ? 'off' : s.isPaused ? 'paused' : `running (${mode})`}. Click for controls, right-click or long-press for quick actions, drag to move.`;
        this._running = isEnabled && !s.isPaused;
        if (!this._running) this.anchor.style.animation = '';

        if (this.menuButtons[0]) {
            this.menuButtons[0].iconEl.textContent = s.isPaused ? 'play_arrow' : 'pause';
            this.menuButtons[0].el.style.color = s.isPaused ? CLAY.accentInk : CLAY.ink2;
        }
        if (this.menuButtons[1]) {
            this.menuButtons[1].el.style.color = isEnabled ? CLAY.run : CLAY.ink3;
        }
    }

    toggleEnable() {
        isEnabled = !isEnabled;
        safeSendMessage({ action: "setEnabled", isEnabled });
        this.updateIcon(); manageClickInterval();
        showStatusToast(isEnabled ? "ScrollSync on" : "ScrollSync off", isEnabled ? 'run' : 'off');
    }

    togglePause() {
        currentSettings.isPaused = !currentSettings.isPaused;
        safeSendMessage({ action: "updateSettingsUI", settings: { isPaused: currentSettings.isPaused } });
        this.updateIcon(); manageClickInterval();
        showStatusToast(currentSettings.isPaused ? "Paused" : "Resumed", currentSettings.isPaused ? 'hold' : 'run');
    }

    onDragStart(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.target.closest && e.target.closest('.clay-menu-btn')) return;
        this._dragging = true; this.isDragging = false; this.dragged = false;
        this._downX = e.clientX; this._downY = e.clientY;
        this.startX = e.clientX - this.posX; this.startY = e.clientY - this.posY;
        document.body.style.userSelect = 'none';
        clearTimeout(this._pressTimer);
        if (e.pointerType !== 'mouse') {
            this._touchAt = performance.now();
            this._pressTimer = setTimeout(() => {
                if (!this._dragging || this.dragged) return;
                this.dragged = true; // swallow the click that follows the long press
                this.toggleMenu();
            }, 500);
        }
    }
    onDrag(e) {
        if (!this._dragging) return;
        // A few pixels of jitter is still a tap, so taps on touch screens don't become drags.
        if (!this.dragged && Math.hypot(e.clientX - this._downX, e.clientY - this._downY) < 5) return;
        clearTimeout(this._pressTimer);
        this.dragged = true; this.isDragging = true; this.posX = Math.min(Math.max(0, e.clientX - this.startX), window.innerWidth - 64); this.posY = Math.min(Math.max(0, e.clientY - this.startY), window.innerHeight - 64); this.container.style.left = `${this.posX}px`; this.container.style.top = `${this.posY}px`; }
    onDragEnd() { clearTimeout(this._pressTimer); if (!this._dragging) return; this._dragging = false; this.startX = 0; this.startY = 0; document.body.style.userSelect = ''; setTimeout(() => { this.isDragging = false; }, 50); }
    onClick(e) { if (this.dragged) { this.dragged = false; return; } if (this.isExpanded) this.toggleMenu(); else toggleOverlayPanel(); }
    remove() {
        clearTimeout(this._pressTimer);
        window.removeEventListener('pointermove', this._onDrag);
        window.removeEventListener('pointerup', this._onDragEnd);
        window.removeEventListener('pointercancel', this._onDragEnd);
        if (this.container && this.container.parentNode) { this.container.parentNode.removeChild(this.container); }
    }
}

// Overlay Panel Logic
let overlayIframe = null;
function toggleOverlayPanel() {
    if (overlayIframe) {
        overlayIframe.style.transform = 'translateX(calc(100% + 40px))';
        setTimeout(() => { overlayIframe.remove(); overlayIframe = null; }, 300);
    } else {
        overlayIframe = document.createElement('iframe');
        overlayIframe.src = chrome.runtime.getURL('index.html');
        overlayIframe.style.cssText = `
            position: fixed; top: 16px; right: 16px;
            width: min(320px, calc(100vw - 32px)); height: min(580px, calc(100vh - 32px)); border: none;
            z-index: 2147483646; border-radius: 24px;
            box-shadow: 10px 10px 30px rgba(40,24,34,0.28), 0 2px 6px rgba(40,24,34,0.12);
            transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
            transform: translateX(calc(100% + 40px));
            background: #ECE7EA;
            pointer-events: auto;
        `;
        if (!shadowHost.parentNode) document.body.appendChild(shadowHost);
        shadowRoot.appendChild(overlayIframe);
        setTimeout(() => { overlayIframe.style.transform = 'translateX(0)'; }, 10);
    }
}

// The hub follows its own setting, not the power state: while ScrollSync is off it stays
// visible in its raised grey "off" look, so its power button can turn ScrollSync back on.
function manageFloatingIcon() {
    if (currentSettings.isFloating) { 
        if (!floatingIcon) floatingIcon = new FloatingIcon(); 
        else floatingIcon.updateIcon(); 
    }
    else if (floatingIcon) { 
        floatingIcon.remove(); 
        floatingIcon = null; 
    }
}

function showStatusToast(message, tone = 'accent') {
    let toast = shadowRoot.getElementById('scrollsync-status-toast');
    if (!toast) {
        toast = document.createElement('div'); toast.id = 'scrollsync-status-toast';
        toast.setAttribute('role', 'status');
        toast.style.cssText = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-8px); display: flex; align-items: center; gap: 10px; background: ${CLAY.ground}; color: ${CLAY.ink}; padding: 10px 18px 10px 14px; border-radius: 9999px; z-index: 2147483647; font-family: 'ScrollSync Manrope', 'Manrope', system-ui, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0; pointer-events: none; opacity: 0; transition: opacity 0.25s, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1); box-shadow: ${CLAY.float};`;
        toast.dot = document.createElement('span');
        toast.dot.style.cssText = 'width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;';
        toast.label = document.createElement('span');
        toast.appendChild(toast.dot); toast.appendChild(toast.label);
        ensureFonts(); if (!shadowHost.parentNode) document.body.appendChild(shadowHost);
        shadowRoot.appendChild(toast);
    }
    const tones = { accent: '#FF2A5F', run: CLAY.run, hold: CLAY.hold, off: CLAY.ink3 };
    toast.dot.style.background = tones[tone] || tones.accent;
    toast.label.textContent = message;
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
    clearTimeout(toast.hideTimeout); toast.hideTimeout = setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(-8px)'; }, 2000);
}

const onKeyDown = (e) => {
    if (retired || !isEnabled) return;
    // Leave browser and OS shortcuts alone: Ctrl+S / Ctrl+D (Windows, Linux), Cmd+W / Cmd+S (Mac).
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const activeElem = document.activeElement;
    if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA' || activeElem.isContentEditable)) return;
    if (e.code === 'Space') { 
        e.preventDefault(); 
        currentSettings.isPaused = !currentSettings.isPaused; 
        safeSendMessage({ action: "updateSettingsUI", settings: { isPaused: currentSettings.isPaused } });
        manageClickInterval(); 
        if (floatingIcon) floatingIcon.updateIcon(); 
        showStatusToast(currentSettings.isPaused ? "Paused" : "Resumed", currentSettings.isPaused ? 'hold' : 'run');
    }
    else if (e.code === 'KeyW') { adjustSpeed(5); } else if (e.code === 'KeyS') { adjustSpeed(-5); }
    else if (e.code === 'KeyA') { handleManualNav('back'); }
    else if (e.code === 'KeyD') { handleManualNav('forward'); }
};
window.addEventListener('keydown', onKeyDown);

function adjustSpeed(delta) {
    if (currentSettings.scrollV.active) {
        const sign = currentSettings.scrollV.speed >= 0 ? 1 : -1;
        let speed = Math.abs(currentSettings.scrollV.speed) + delta;
        speed = Math.max(0, Math.min(500, speed));
        currentSettings.scrollV.speed = speed * sign;
        safeSendMessage({ action: "updateSettingsUI", settings: { vSpeed: currentSettings.scrollV.speed } });
        showStatusToast(`Speed ${speed} px/s`);
    } else if (currentSettings.nav.active) {
        let interval = (currentSettings.nav.interval / 1000) - (delta / 5);
        interval = Math.max(1, Math.min(60, interval));
        currentSettings.nav.interval = interval * 1000;
        safeSendMessage({ action: "updateSettingsUI", settings: { navInterval: interval } });
        manageClickInterval(); 
        showStatusToast(`Pulse every ${interval} s`);
    }
}

function applyState(state) {
    if (!state) return;
    isEnabled = state.isEnabled;
    const s = state.userSettings;
    const posX = (typeof s.navPosX === 'number')
        ? s.navPosX
        : (s.navPos === 'left' ? 10 : s.navPos === 'center' ? 50 : 90);
    currentSettings = {
        isPaused: state.isPaused || false,
        isFloating: s.isFloating || false,
        scrollV: { active: s.vToggle, speed: s.vSpeed },
        nav: { active: s.navToggle, position: s.navPos, posX, interval: s.navInterval * 1000 },
        pad: { active: s.padToggle, vActive: s.padVActive, hActive: s.padHActive, clickActive: s.padClickActive, stick: s.padStick, sensitivity: s.padSens }
    };
    startMainLoop(); manageClickInterval(); manageFloatingIcon();
}

const onRuntimeMessage = (request, sender, sendResponse) => {
  if (retired) return false;
  if (request.action === 'ping') {
    sendResponse({ status: 'pong' });
  } else if (request.action === 'update') {
    isEnabled = request.isEnabled !== undefined ? request.isEnabled : isEnabled;
    const nav = request.nav || {};
    if (typeof nav.posX !== 'number') {
      nav.posX = nav.position === 'left' ? 10 : nav.position === 'center' ? 50 : 90;
    }
    currentSettings = { isPaused: request.isPaused, isFloating: request.isFloating || false, scrollV: request.scrollV, nav, pad: request.pad };
    startMainLoop(); manageClickInterval(); manageFloatingIcon();
    sendResponse({ status: 'updated' });
  } else if (request.action === 'stateChanged') {
    isEnabled = request.isEnabled;
    startMainLoop(); manageClickInterval(); manageFloatingIcon();
    sendResponse({ status: 'stateChanged' });
  } else if (request.action === 'floatChanged') {
    currentSettings.isFloating = request.isFloating; manageFloatingIcon();
    sendResponse({ status: 'floatChanged' });
  } else if (request.action === 'manualNav') {
    handleManualNav(request.direction); sendResponse({ status: 'navigated' });
  } else if (request.action === 'pauseChanged') {
    currentSettings.isPaused = request.isPaused; manageClickInterval(); if (floatingIcon) floatingIcon.updateIcon();
    sendResponse({ status: 'pauseChanged' });
  }
  return false;
};
chrome.runtime.onMessage.addListener(onRuntimeMessage);

const _onScrollOrResize = () => {
  if (currentSettings.nav && currentSettings.nav.active) updateClickIndicator();
};
window.addEventListener('scroll', _onScrollOrResize, true);
window.addEventListener('resize', _onScrollOrResize);

const sync = () => {
    safeSendMessage({ action: "injectScrollHelper" });
    safeSendMessage({ action: "getState" }, (state) => {
        applyState(state);
    });
};

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', sync); } else { sync(); }
window.addEventListener('load', sync);

// A newer copy of ScrollSync arrived on this page: stop everything and leave no UI behind.
function retire() {
    if (retired) return;
    retired = true;
    isEnabled = false;
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    if (clickIntervalId) { clearInterval(clickIntervalId); clickIntervalId = null; }
    if (clickIndicatorTickId) { clearInterval(clickIndicatorTickId); clickIndicatorTickId = null; }
    if (clickIndicatorEl) { clickIndicatorEl.remove(); clickIndicatorEl = null; }
    if (floatingIcon) { floatingIcon.remove(); floatingIcon = null; }
    if (overlayIframe) { overlayIframe.remove(); overlayIframe = null; }
    if (shadowHost.parentNode) shadowHost.remove();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('scroll', _onScrollOrResize, true);
    window.removeEventListener('resize', _onScrollOrResize);
    window.removeEventListener('load', sync);
    document.removeEventListener('DOMContentLoaded', sync);
    document.removeEventListener('scrollsync:takeover', retire);
    try { chrome.runtime.onMessage.removeListener(onRuntimeMessage); } catch (_) {}
}
document.addEventListener('scrollsync:takeover', retire); 
