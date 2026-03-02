let animationId = null;
let clickIntervalId = null;
let lastTimestamp = 0;
let isEnabled = false;
let currentSettings = {
  isPaused: false,
  isFloating: false,
  scrollV: { active: false, speed: 0 },
  scrollH: { active: false, speed: 0 },
  nav: { active: false, position: 'right', interval: 5000 },
  pad: { active: false, vActive: false, hActive: false, clickActive: false, stick: 'left', sensitivity: 15 }
};

let lastButtonState = false;
let stickClickThresholdReached = false; 

const ICONS = {
    play: `<svg viewBox="0 0 256 256" width="16" height="16"><path fill="currentColor" d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.75a16,16,0,0,1-24.32-13.75V40a16,16,0,0,1,24.32-13.75L232.4,114.49A15.74,15.74,0,0,1,240,128Z"/></svg>`,
    pause: `<svg viewBox="0 0 256 256" width="16" height="16"><path fill="currentColor" d="M216,48V208a16,16,0,0,1-16,16H160a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h40A16,16,0,0,1,216,48ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Z"/></svg>`,
    power: `<svg viewBox="0 0 256 256" width="16" height="16"><path fill="currentColor" d="M128,24a8,8,0,0,0-8,8V120a8,8,0,0,0,16,0V32A8,8,0,0,0,128,24ZM190.06,53.94a8,8,0,0,0-11.32,11.32,80,80,0,1,1-101.48,0,8,8,0,0,0-11.32-11.32,96,96,0,1,0,124.12,0Z"/></svg>`,
    info: `<svg viewBox="0 0 256 256" width="16" height="16"><path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8H120a8,8,0,0,1,0-16h8V128H120a8,8,0,0,1,0-16h16a8,8,0,0,1,8,8v40Zm-20-80a12,12,0,1,1,12-12A12,12,0,0,1,124,96Z"/></svg>`,
    close: `<svg viewBox="0 0 256 256" width="16" height="16"><path fill="currentColor" d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>`
};

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
    if (animationId) cancelAnimationFrame(animationId);
    if (clickIntervalId) clearInterval(clickIntervalId);
    if (floatingIcon) {
        floatingIcon.remove();
        floatingIcon = null;
    }
    console.warn("[ScrollSync] Extension context invalidated. Script execution stopped. Please refresh the page.");
}

function getScrollableElement(axis = 'vertical') {
  if (!isEnabled) return null;
  const isVertical = axis === 'vertical';
  const scroller = document.scrollingElement || document.documentElement;
  const scrollSize = isVertical ? scroller.scrollHeight : scroller.scrollWidth;
  const clientSize = isVertical ? window.innerHeight : window.innerWidth;
  if (scrollSize > clientSize) return window; 
  const elements = document.querySelectorAll('*');
  let bestElem = null;
  let maxScroll = 0;
  for (const el of elements) {
    const style = window.getComputedStyle(el);
    const overflow = isVertical ? style.overflowY : style.overflowX;
    if (overflow === 'auto' || overflow === 'scroll') {
      const sSize = isVertical ? el.scrollHeight : el.scrollWidth;
      const cSize = isVertical ? el.clientHeight : el.clientWidth;
      if (sSize > cSize && sSize > maxScroll) { maxScroll = sSize; bestElem = el; }
    }
  }
  return bestElem;
}

function showVisualFeedback(x, y) {
    if (!isEnabled) return;
    const dot = document.createElement('div');
    dot.style.cssText = `position: fixed; left: ${x - 5}px; top: ${y - 5}px; width: 10px; height: 10px; background: #7b61ff; border-radius: 50%; z-index: 1000000; pointer-events: none; transition: transform 0.4s, opacity 0.4s; box-shadow: 0 0 15px #7b61ff; border: 2px solid white;`;
    document.body.appendChild(dot);
    setTimeout(() => { dot.style.transform = 'scale(4)'; dot.style.opacity = '0'; setTimeout(() => dot.remove(), 400); }, 10);
}

function simulateSmartClick(forcedPosition = null) {
  if (!isEnabled || currentSettings.isPaused) return;
  const targetEl = (function() {
    const images = document.querySelectorAll('img, canvas, [role="img"]');
    let best = null; let maxArea = 0;
    images.forEach(img => {
        const rect = img.getBoundingClientRect();
        const area = (Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)) * (Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        if (area > maxArea) { maxArea = area; best = img; }
    });
    return best;
  })();
  const position = forcedPosition || currentSettings.nav.position;
  let x, y;
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const margin = rect.width * 0.1;
    if (position === 'right') { x = rect.right - margin; y = rect.top + (rect.height / 2); }
    else if (position === 'left') { x = rect.left + margin; y = rect.top + (rect.height / 2); }
    else { x = rect.left + (rect.width / 2); y = rect.top + (rect.height / 2); }
  } else {
    x = position === 'right' ? window.innerWidth * 0.85 : (position === 'left' ? window.innerWidth * 0.15 : window.innerWidth / 2);
    y = window.innerHeight / 2;
  }
  const clickTarget = document.elementFromPoint(x, y) || targetEl;
  if (clickTarget) {
    showVisualFeedback(x, y);
    const eventProps = { view: window, bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: 1 };
    clickTarget.dispatchEvent(new PointerEvent('pointerdown', eventProps));
    clickTarget.dispatchEvent(new MouseEvent('mousedown', eventProps));
    clickTarget.dispatchEvent(new PointerEvent('pointerup', eventProps));
    clickTarget.dispatchEvent(new MouseEvent('mouseup', eventProps));
    clickTarget.dispatchEvent(new MouseEvent('click', eventProps));
  }
}

function pollGamepad() {
  if (!isEnabled) return { v: 0, h: 0 };
  const pad = Array.from(navigator.getGamepads()).find(p => p !== null);
  if (!pad) return { v: 0, h: 0 };
  const h = Math.abs(currentSettings.pad.stick === 'left' ? pad.axes[0] : (pad.axes[2] || pad.axes[3])) > 0.1 ? (currentSettings.pad.stick === 'left' ? pad.axes[0] : (pad.axes[2] || pad.axes[3])) : 0;
  const v = Math.abs(currentSettings.pad.stick === 'left' ? pad.axes[1] : (pad.axes[3] || pad.axes[4])) > 0.1 ? (currentSettings.pad.stick === 'left' ? pad.axes[1] : (pad.axes[3] || pad.axes[4])) : 0;
  if (currentSettings.pad.clickActive) {
    const isPressed = pad.buttons[0].pressed || pad.buttons[7].pressed;
    if (isPressed && !lastButtonState) simulateSmartClick();
    lastButtonState = isPressed;
    if (Math.abs(h) > 0.9) { if (!stickClickThresholdReached) { simulateSmartClick(h > 0 ? 'right' : 'left'); stickClickThresholdReached = true; } }
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
        const target = getScrollableElement('vertical');
        if (target) {
          const move = currentSettings.scrollV.speed * elapsedSec;
          if (target === window) window.scrollBy(0, move);
          else target.scrollTop += move;
        }
      }
      if (currentSettings.scrollH.active && currentSettings.scrollH.speed !== 0) {
        const target = getScrollableElement('horizontal');
        if (target) {
          const move = currentSettings.scrollH.speed * elapsedSec;
          if (target === window) window.scrollBy(move, 0);
          else target.scrollLeft += move;
        }
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

function manageClickInterval() {
    if (clickIntervalId) clearInterval(clickIntervalId);
    if (isEnabled && currentSettings.nav.active && !currentSettings.isPaused) {
        clickIntervalId = setInterval(simulateSmartClick, currentSettings.nav.interval);
    }
}

function handleManualNav(direction) {
    if (!isEnabled) return;
    if (currentSettings.nav.active) {
        const newPos = direction === 'back' ? 'left' : 'right';
        currentSettings.nav.position = newPos;
        safeSendMessage({ action: "updateSettingsUI", settings: { navPos: newPos } });
    } else if (currentSettings.scrollV.active) {
        const speed = Math.abs(currentSettings.scrollV.speed) || 40;
        currentSettings.scrollV.speed = direction === 'back' ? -speed : speed;
        safeSendMessage({ action: "updateSettingsUI", settings: { vSpeed: currentSettings.scrollV.speed } });
    } else if (currentSettings.scrollH.active) {
        const speed = Math.abs(currentSettings.scrollH.speed) || 40;
        currentSettings.scrollH.speed = direction === 'back' ? -speed : speed;
        safeSendMessage({ action: "updateSettingsUI", settings: { hSpeed: currentSettings.scrollH.speed } });
    }
    if (floatingIcon) floatingIcon.updateIcon();
}

let floatingIcon = null;

class FloatingIcon {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'scrollsync-floating-container';
        this.isDragging = false;
        this.dragged = false;
        this.isExpanded = false;
        this.startX = 0; this.startY = 0;
        this.posX = window.innerWidth - 80;
        this.posY = window.innerHeight - 80;
        this.menuButtons = [];
        this.init();
    }

    init() {
        this.container.style.cssText = `
            position: fixed; left: ${this.posX}px; top: ${this.posY}px;
            width: 56px; height: 56px; background: #ffffff;
            display: flex; align-items: center; justify-content: center;
            cursor: move; z-index: 2147483647;
            box-shadow: 0 10px 25px rgba(255, 77, 133, 0.2);
            border: 3px solid #ff4d85;
            border-radius: 50%;
            user-select: none; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        `;

        this.logoImg = document.createElement('img');
        this.logoImg.src = chrome.runtime.getURL('icon.png');
        this.logoImg.style.cssText = `width: 32px; height: 32px; pointer-events: none; transition: filter 0.3s;`;
        this.container.appendChild(this.logoImg);

        this.statusBadge = document.createElement('div');
        this.statusBadge.style.cssText = `position: absolute; bottom: 2px; right: 2px; width: 14px; height: 14px; background: #ff4d85; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.1);`;
        this.container.appendChild(this.statusBadge);

        this.menu = document.createElement('div');
        this.menu.style.cssText = `position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none;`;
        this.container.appendChild(this.menu);

        this.updateIcon();
        this.container.addEventListener('mousedown', (e) => this.onDragStart(e));
        this.container.addEventListener('click', (e) => this.onClick(e));
        this.container.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!this.dragged) this.toggleMenu(); });
        document.body.appendChild(this.container);
        window.addEventListener('mousemove', (e) => this.onDrag(e));
        window.addEventListener('mouseup', () => this.onDragEnd());
        this.createMenu();
    }

    createMenu() {
        const actions = [
            { id: 'pause', icon: ICONS.pause, color: '#ff4d85', action: () => this.togglePause() },
            { id: 'power', icon: ICONS.power, color: '#7b61ff', action: () => this.toggleEnable() },
            { id: 'guide', icon: ICONS.info, color: '#475569', action: () => safeSendMessage({ action: "openGuide" }) }
        ];
        actions.forEach((item, index) => {
            const btn = document.createElement('div');
            btn.innerHTML = item.icon;
            btn.style.cssText = `position: absolute; width: 36px; height: 36px; background: #ffffff; border: 2px solid ${item.color}; display: flex; align-items: center; justify-content: center; color: ${item.color}; border-radius: 50%; cursor: pointer; pointer-events: auto; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); transform: scale(0); opacity: 0; top: 10px; left: 10px; shadow: 0 4px 10px rgba(0,0,0,0.1);`;
            btn.addEventListener('click', (e) => { e.stopPropagation(); item.action(); });
            this.menu.appendChild(btn);
            this.menuButtons.push({ el: btn, angle: (index * 120) - 150 });
        });
    }

    toggleMenu() {
        this.isExpanded = !this.isExpanded;
        this.menuButtons.forEach((btn) => {
            if (this.isExpanded) {
                const dist = 70;
                const x = Math.cos(btn.angle * Math.PI / 180) * dist;
                const y = Math.sin(btn.angle * Math.PI / 180) * dist;
                btn.el.style.transform = `translate(${x}px, ${y}px) scale(1)`;
                btn.el.style.opacity = '1';
            } else {
                btn.el.style.transform = `translate(0, 0) scale(0)`;
                btn.el.style.opacity = '0';
            }
        });
        this.container.style.transform = this.isExpanded ? 'scale(1.1) rotate(10deg)' : 'scale(1)';
    }

    updateIcon() {
        if (!isEnabled) {
            this.statusBadge.style.background = '#cbd5e0'; 
            this.container.style.borderColor = '#cbd5e0'; 
            this.container.style.boxShadow = 'none'; 
            this.logoImg.style.filter = 'grayscale(1) opacity(0.5)';
        } else if (currentSettings.isPaused) {
            this.statusBadge.style.background = '#f43f5e'; 
            this.container.style.borderColor = '#f43f5e'; 
            this.container.style.boxShadow = '0 10px 25px rgba(244, 63, 94, 0.2)'; 
            this.logoImg.style.filter = 'grayscale(0.5) opacity(0.8)';
        } else {
            this.statusBadge.style.background = '#10b981'; 
            this.container.style.borderColor = '#ff4d85'; 
            this.container.style.boxShadow = '0 10px 25px rgba(255, 77, 133, 0.2)'; 
            this.logoImg.style.filter = 'none';
        }
        if (this.menuButtons[0]) {
            this.menuButtons[0].el.innerHTML = currentSettings.isPaused ? ICONS.play : ICONS.pause;
            this.menuButtons[0].el.style.borderColor = currentSettings.isPaused ? '#10b981' : '#ff4d85';
            this.menuButtons[0].el.style.color = currentSettings.isPaused ? '#10b981' : '#ff4d85';
        }
    }

    toggleEnable() {
        isEnabled = !isEnabled;
        safeSendMessage({ action: "updateState", isEnabled: isEnabled, isPaused: currentSettings.isPaused, userSettings: { ...currentSettings, isEnabled } });
        this.updateIcon(); manageClickInterval();
        showStatusToast(isEnabled ? "System Linked" : "System Offline");
    }

    togglePause() {
        currentSettings.isPaused = !currentSettings.isPaused;
        safeSendMessage({ action: "updateSettingsUI", settings: { isPaused: currentSettings.isPaused } });
        this.updateIcon(); manageClickInterval();
        showStatusToast(currentSettings.isPaused ? "System Halted" : "System Resumed");
    }

    onDragStart(e) { this.isDragging = false; this.dragged = false; this.startX = e.clientX - this.posX; this.startY = e.clientY - this.posY; document.body.style.userSelect = 'none'; }
    onDrag(e) { if (this.startX === 0) return; this.dragged = true; this.isDragging = true; this.posX = Math.min(Math.max(0, e.clientX - this.startX), window.innerWidth - 56); this.posY = Math.min(Math.max(0, e.clientY - this.startY), window.innerHeight - 56); this.container.style.left = `${this.posX}px`; this.container.style.top = `${this.posY}px`; }
    onDragEnd() { if (!this.startX) return; this.startX = 0; this.startY = 0; document.body.style.userSelect = ''; setTimeout(() => { this.isDragging = false; }, 50); }
    onClick(e) { if (this.dragged) { this.dragged = false; return; } toggleOverlayPanel(); }
    remove() { if (this.container && this.container.parentNode) { this.container.parentNode.removeChild(this.container); } }
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
            position: fixed; top: 20px; right: 20px;
            width: 320px; height: 550px; border: none;
            z-index: 2147483646; border-radius: 32px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.2);
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            transform: translateX(calc(100% + 40px));
            background: transparent;
        `;
        document.body.appendChild(overlayIframe);
        setTimeout(() => { overlayIframe.style.transform = 'translateX(0)'; }, 10);
    }
}

function manageFloatingIcon() {
    if (currentSettings.isFloating) { if (!floatingIcon) floatingIcon = new FloatingIcon(); else floatingIcon.updateIcon(); }
    else if (floatingIcon) { floatingIcon.remove(); floatingIcon = null; }
}

function showStatusToast(message) {
    let toast = document.getElementById('scrollsync-status-toast');
    if (!toast) {
        toast = document.createElement('div'); toast.id = 'scrollsync-status-toast';
        toast.style.cssText = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #ff4d85, #7b61ff); color: #ffffff; padding: 10px 20px; border-radius: 20px; z-index: 2147483647; font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; pointer-events: none; transition: opacity 0.3s, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 10px 20px rgba(255, 77, 133, 0.3); border: 2px solid white;`;
        document.body.appendChild(toast);
    }
    toast.innerText = message; toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0) scale(1)';
    clearTimeout(toast.hideTimeout); toast.hideTimeout = setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(-20px) scale(0.9)'; }, 2000);
}

window.addEventListener('keydown', (e) => {
    if (!isEnabled) return;
    const activeElem = document.activeElement;
    if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA' || activeElem.isContentEditable)) return;
    if (e.code === 'Space') { 
        e.preventDefault(); 
        currentSettings.isPaused = !currentSettings.isPaused; 
        safeSendMessage({ action: "updateSettingsUI", settings: { isPaused: currentSettings.isPaused } });
        manageClickInterval(); 
        if (floatingIcon) floatingIcon.updateIcon(); 
        showStatusToast(currentSettings.isPaused ? "System Halted" : "System Resumed"); 
    }
    else if (e.code === 'KeyW') { adjustSpeed(5); } else if (e.code === 'KeyS') { adjustSpeed(-5); }
    else if (e.code === 'KeyA') { handleManualNav('back'); showStatusToast("NAV: Backward"); }
    else if (e.code === 'KeyD') { handleManualNav('forward'); showStatusToast("NAV: Forward"); }
});

function adjustSpeed(delta) {
    if (currentSettings.scrollV.active) {
        const sign = currentSettings.scrollV.speed >= 0 ? 1 : -1;
        let speed = Math.abs(currentSettings.scrollV.speed) + delta;
        speed = Math.max(0, Math.min(500, speed));
        currentSettings.scrollV.speed = speed * sign;
        safeSendMessage({ action: "updateSettingsUI", settings: { vSpeed: currentSettings.scrollV.speed } });
        showStatusToast(`Speed: ${speed} px/s`);
    } else if (currentSettings.scrollH.active) {
        const sign = currentSettings.scrollH.speed >= 0 ? 1 : -1;
        let speed = Math.abs(currentSettings.scrollH.speed) + delta;
        speed = Math.max(0, Math.min(500, speed));
        currentSettings.scrollH.speed = speed * sign;
        safeSendMessage({ action: "updateSettingsUI", settings: { hSpeed: currentSettings.scrollH.speed } });
        showStatusToast(`Speed: ${speed} px/s`);
    } else if (currentSettings.nav.active) {
        let interval = (currentSettings.nav.interval / 1000) - (delta / 5);
        interval = Math.max(1, Math.min(60, interval));
        currentSettings.nav.interval = interval * 1000;
        safeSendMessage({ action: "updateSettingsUI", settings: { navInterval: interval } });
        showStatusToast(`Pulse: ${interval}s`);
    }
}

function applyState(state) {
    if (!state) return;
    isEnabled = state.isEnabled;
    const s = state.userSettings;
    currentSettings = { 
        isPaused: state.isPaused || false, 
        isFloating: s.isFloating || false, 
        scrollV: { active: s.vToggle, speed: s.vSpeed }, 
        scrollH: { active: s.hToggle, speed: s.hSpeed }, 
        nav: { active: s.navToggle, position: s.navPos, interval: s.navInterval * 1000 }, 
        pad: { active: s.padToggle, vActive: s.padVActive, hActive: s.padHActive, clickActive: s.padClickActive, stick: s.padStick, sensitivity: s.padSens } 
    };
    lastTimestamp = 0; startMainLoop(); manageClickInterval(); manageFloatingIcon();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'update') {
    isEnabled = request.isEnabled !== undefined ? request.isEnabled : isEnabled;
    currentSettings = { isPaused: request.isPaused, isFloating: request.isFloating || false, scrollV: request.scrollV, scrollH: request.scrollH, nav: request.nav, pad: request.pad };
    lastTimestamp = 0; startMainLoop(); manageClickInterval(); manageFloatingIcon();
    sendResponse({ status: 'updated' });
  } else if (request.action === 'stateChanged') {
    isEnabled = request.isEnabled;
    manageClickInterval(); if (floatingIcon) floatingIcon.updateIcon();
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
});

const sync = () => { 
    safeSendMessage({ action: "getState" }, (state) => { 
        applyState(state); 
    }); 
};

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', sync); } else { sync(); }
window.addEventListener('load', sync); 
