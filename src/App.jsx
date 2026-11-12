import React, { useState, useEffect } from 'react';

/* ── Clay primitives ──────────────────────────────────────── */

const Icon = ({ name, fill = false, size = 20, className = '' }) => (
  <span
    aria-hidden="true"
    className={`icon ${className}`}
    style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' 24` }}
  >
    {name}
  </span>
);

const tipAlign = (i, n) => (i === 0 ? 'start' : i === n - 1 ? 'end' : undefined);

const Switch = ({ checked, onChange, label, tip, tipAlign: align = 'end' }) => (
  <label className="clay-switch" data-tip={tip} data-tip-align={tip ? align : undefined}>
    <input type="checkbox" role="switch" aria-label={label} checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="track" />
    <span className="knob" />
  </label>
);

const ModeRow = ({ title, hint, checked, onChange, tip }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[14px] font-extrabold text-ink leading-tight">{title}</span>
      <span className="text-[11px] font-semibold text-ink-2 leading-snug">{hint}</span>
    </div>
    <Switch checked={checked} onChange={onChange} label={title} tip={tip} />
  </div>
);

const Slider = ({ label, value, unit, min, max, onChange }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-ink-2">{label}</span>
        <span className="well">{value}<small>{unit}</small></span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="clay-range"
        style={{ '--pct': `${pct}%` }}
      />
    </div>
  );
};

const Segmented = ({ label, options, value, onChange }) => (
  <div role="radiogroup" aria-label={label} className="tray">
    {options.map((o, i) => (
      <button
        key={o.value}
        type="button"
        role="radio"
        aria-checked={value === o.value}
        onClick={() => onChange(o.value)}
        data-tip={o.tip}
        data-tip-align={o.tip ? tipAlign(i, options.length) : undefined}
        className="seg seg-sm"
      >
        {o.icon && <Icon name={o.icon} size={16} />}
        {o.label}
      </button>
    ))}
  </div>
);

// ScrollSync chevron mark, same geometry as icon.svg. On: the logo's pink-to-orange; off: clay ink.
const Mark = ({ className = '', on = false }) => (
  <svg viewBox="0 0 1731.6 1731.6" className={className} aria-hidden="true" fill={on ? 'url(#ss-mark)' : 'currentColor'}>
    <defs>
      <linearGradient id="ss-mark" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1731.6" y2="1731.6">
        <stop offset="0" stopColor="#E8194F" />
        <stop offset="1" stopColor="#EE5F12" />
      </linearGradient>
    </defs>
    <polygon points="865.9 1052.3 1137.6 1459.9 865.9 1731.6 594.2 1459.9 865.9 1052.3" />
    <polygon points="1386.6 1210.9 1258.4 1339 865.9 749.9 473.2 1339 345.1 1210.9 865.9 429.7 1386.6 1210.9" />
    <polygon points="1731.6 865.8 1507.5 1090 865.9 127.3 224.2 1090 0 865.8 865.9 0 1731.6 865.8" />
  </svg>
);

const TABS = [
  { id: 'v-tab', label: 'Scroll', icon: 'swap_vert', mode: 'vToggle', tip: 'Auto-scroll settings: speed and direction' },
  { id: 'click-tab', label: 'Auto', icon: 'touch_app', mode: 'navToggle', tip: 'Auto Pulse settings: clicks an image on a timer' },
  { id: 'pad-tab', label: 'Pad', icon: 'stadia_controller', mode: 'padToggle', tip: 'Gamepad settings: scroll and click with a controller' },
];

// Tabs opened before the extension was installed or reloaded have no live content script,
// so popup messages (hub, modes, pause) reach nothing. Ping the page and inject the script
// if nobody answers. Browser pages (chrome://, new tab, Web Store) can't be scripted.
const ensureContentScript = async (tab) => {
  if (tab.url && !/^(https?|file):/.test(tab.url)) return;
  // Still loading: Chrome injects the manifest copy itself, so injecting now would add a second.
  if (tab.status && tab.status !== 'complete') return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
  } catch {
    const files = chrome.runtime.getManifest().content_scripts?.[0]?.js || [];
    if (files.length) await chrome.scripting.executeScript({ target: { tabId: tab.id }, files }).catch(() => {});
  }
};

const App = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState('v-tab');
  const [settings, setSettings] = useState({
    vToggle: false,
    vSpeed: 0,
    navToggle: false,
    navPos: 'right',
    navPosX: 90,
    navInterval: 5,
    padToggle: false,
    padVActive: false,
    padHActive: false,
    padClickActive: false,
    padStick: 'left',
    padSens: 15,
    isFloating: false
  });
  const [tabId, setTabId] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        setTabId(tab.id);
        ensureContentScript(tab);

        chrome.runtime.sendMessage({ action: "getState", tabId: tab.id }, (state) => {
          if (state) {
            setIsEnabled(state.isEnabled);
            setIsPaused(state.isPaused);
            const us = { ...state.userSettings };
            if (typeof us.navPosX !== 'number') {
              us.navPosX = us.navPos === 'left' ? 10 : us.navPos === 'center' ? 50 : 90;
            }
            setSettings(us);
            if (us.activeTab) {
              setActiveTab(us.activeTab === 'h-tab' ? 'v-tab' : us.activeTab);
            }
          }
        });
      } catch (err) {
        console.error("Init error:", err);
      }
    };

    init();

    const messageListener = (message) => {
      if (message.action === "pauseChanged") {
        setIsPaused(message.isPaused);
      } else if (message.action === "stateChanged") {
        setIsEnabled(message.isEnabled);
      } else if (message.action === "refreshUI") {
        setSettings(message.settings);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  const saveAndSync = (newSettings, newEnabled, newPaused, newTab) => {
    if (!tabId) return;

    const s = newSettings || settings;
    const e = newEnabled !== undefined ? newEnabled : isEnabled;
    const p = newPaused !== undefined ? newPaused : isPaused;
    const t = newTab !== undefined ? newTab : activeTab;

    const fullSettings = { ...s, activeTab: t };

    chrome.runtime.sendMessage({
      action: "updateState",
      tabId,
      isEnabled: e,
      isPaused: p,
      userSettings: fullSettings
    }).catch(() => {});

    chrome.tabs.sendMessage(tabId, {
      action: 'update',
      isEnabled: e,
      isPaused: p,
      isFloating: s.isFloating,
      scrollV: { active: s.vToggle, speed: s.vSpeed },
      nav: { active: s.navToggle, position: s.navPos, posX: s.navPosX, interval: s.navInterval * 1000 },
      pad: {
        active: s.padToggle,
        vActive: s.padVActive,
        hActive: s.padHActive,
        clickActive: s.padClickActive,
        stick: s.padStick,
        sensitivity: s.padSens
      }
    }).catch(() => {});
  };

  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    if (key === 'vToggle' && value) { newSettings.navToggle = false; newSettings.padToggle = false; if (!newSettings.vSpeed) newSettings.vSpeed = 100; }
    if (key === 'navToggle' && value) { newSettings.vToggle = false; newSettings.padToggle = false; }
    if (key === 'padToggle' && value) { newSettings.vToggle = false; newSettings.navToggle = false; }

    const isModeEnable = ['vToggle', 'navToggle', 'padToggle'].includes(key) && value;
    const newEnabled = isModeEnable && !isEnabled ? true : undefined;
    if (newEnabled) setIsEnabled(true);

    setSettings(newSettings);
    saveAndSync(newSettings, newEnabled);
  };

  const changeTab = (id) => {
    setActiveTab(id);
    if (!tabId) return;
    chrome.runtime.sendMessage({
      action: "updateState",
      tabId,
      isEnabled,
      isPaused,
      userSettings: { ...settings, activeTab: id }
    }).catch(() => {});
  };

  const toggleGlobal = () => {
    const newVal = !isEnabled;
    setIsEnabled(newVal);
    saveAndSync(settings, newVal);
  };

  const togglePause = () => {
    const newVal = !isPaused;
    setIsPaused(newVal);
    saveAndSync(settings, isEnabled, newVal);
  };

  const openGuide = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('guide.html') });
  };

  const manualNav = (direction) => {
    if (tabId) chrome.tabs.sendMessage(tabId, { action: "manualNav", direction }).catch(() => {});
  };

  // Direction lives in the sign of vSpeed; a zero speed has no sign, so pick a usable default.
  const setScrollDirection = (dir) => {
    const mag = Math.abs(settings.vSpeed) || 100;
    updateSetting('vSpeed', dir === 'up' ? -mag : mag);
  };

  /* ── Derived state ── */
  const speedMag = Math.abs(settings.vSpeed || 0);
  const scrollDir = settings.vSpeed < 0 ? 'up' : 'down';
  const posX = settings.navPosX ?? 90;
  const running = isEnabled && !isPaused;

  let status = { text: 'Off', tone: 'text-ink-2', dot: 'bg-ink-3' };
  if (isEnabled && isPaused) {
    status = { text: 'Paused', tone: 'text-hold', dot: 'bg-hold' };
  } else if (isEnabled) {
    if (settings.vToggle) status = { text: `${scrollDir === 'up' ? 'Up' : 'Down'} · ${speedMag} px/s`, tone: 'text-run', dot: 'bg-run' };
    else if (settings.navToggle) status = { text: `Pulse every ${settings.navInterval} s`, tone: 'text-run', dot: 'bg-run' };
    else if (settings.padToggle) status = { text: 'Gamepad mode', tone: 'text-run', dot: 'bg-run' };
    else status = { text: 'On · pick a mode', tone: 'text-ink-2', dot: 'bg-ink-2' };
  }

  const navLabels = settings.navToggle
    ? { back: 'Move click point left', fwd: 'Move click point right' }
    : { back: 'Scroll up', fwd: 'Scroll down' };

  const domeState = !isEnabled ? 'off' : isPaused ? 'paused' : 'running';

  return (
    <div
      data-power={isEnabled ? 'on' : 'off'}
      className="app-pad bg-clay text-ink flex flex-col select-none font-body"
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="raise-sm w-10 h-10 rounded-full flex items-center justify-center shrink-0">
            <Mark on={isEnabled} className="w-5 h-5 text-ink-3" />
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-[16px] font-extrabold tracking-[-0.01em] leading-tight">ScrollSync</h1>
            <span className={`flex items-center gap-1.5 text-[11px] font-bold leading-tight ${status.tone}`} role="status" aria-live="polite">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} />
              <span className="truncate">{status.text}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => updateSetting('isFloating', !settings.isFloating)}
            data-tip={settings.isFloating ? 'Hide the floating control on this page' : 'Show a floating control on this page'}
            data-tip-align="end"
            aria-label="On-page hub"
            aria-pressed={!!settings.isFloating}
            className="clay-btn w-8 h-8 rounded-full"
          >
            <Icon name="radio_button_checked" fill={!!settings.isFloating} size={18} />
          </button>
          <Switch checked={isEnabled} onChange={toggleGlobal} label="ScrollSync on this tab" tip={isEnabled ? 'Turn ScrollSync off for this tab' : 'Turn ScrollSync on for this tab'} />
        </div>
      </header>

      {/* Mode tabs */}
      <nav className="px-4 pt-2 pb-1">
        <div role="tablist" aria-label="Mode" className="tray tray-channel">
          {TABS.map((t, i) => {
            const selected = activeTab === t.id;
            const live = isEnabled && settings[t.mode];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => changeTab(t.id)}
                data-tip={t.tip}
                data-tip-align={tipAlign(i, TABS.length)}
                className="seg"
              >
                <Icon name={t.icon} fill={selected} size={18} />
                {t.label}
                {live && (<><span aria-hidden="true" className="absolute top-1.5 right-3 w-1.5 h-1.5 rounded-full bg-run" /><span className="sr-only">(running)</span></>)}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Active mode */}
      <main className="px-4 pt-4 pb-2">
        <section className="raise rounded-2xl p-4 flex flex-col gap-5" role="tabpanel">
          {activeTab === 'v-tab' && (
            <>
              <ModeRow
                title="Auto-scroll"
                hint="Moves the page at a steady speed"
                checked={settings.vToggle}
                onChange={(val) => updateSetting('vToggle', val)}
                tip={settings.vToggle ? 'Stop auto-scrolling' : 'Start auto-scrolling. Other modes switch off.'}
              />
              <Segmented
                label="Direction"
                value={scrollDir}
                onChange={setScrollDirection}
                options={[
                  { value: 'down', label: 'Down', icon: 'south', tip: 'Scroll down the page (D key)' },
                  { value: 'up', label: 'Up', icon: 'north', tip: 'Scroll up the page (A key)' },
                ]}
              />
              <Slider
                label="Speed"
                value={speedMag}
                unit="px/s"
                min={0}
                max={500}
                onChange={(mag) => updateSetting('vSpeed', settings.vSpeed < 0 ? -mag : mag)}
              />
            </>
          )}

          {activeTab === 'click-tab' && (
            <>
              <ModeRow
                title="Auto Pulse"
                hint="Clicks the largest image on a timer"
                checked={settings.navToggle}
                onChange={(val) => updateSetting('navToggle', val)}
                tip={settings.navToggle ? 'Stop clicking' : 'Start clicking on a timer. Other modes switch off.'}
              />
              <Segmented
                label="Click point"
                value={posX}
                onChange={(x) => updateSetting('navPosX', x)}
                options={[
                  { value: 10, label: 'Left', tip: 'Click the left side of the image (A key)' },
                  { value: 50, label: 'Center', tip: 'Click the middle of the image' },
                  { value: 90, label: 'Right', tip: 'Click the right side of the image (D key)' },
                ]}
              />
              <Slider label="Click position" value={posX} unit="%" min={0} max={100} onChange={(v) => updateSetting('navPosX', v)} />
              <Slider label="Interval" value={settings.navInterval} unit="s" min={1} max={60} onChange={(v) => updateSetting('navInterval', v)} />
            </>
          )}

          {activeTab === 'pad-tab' && (
            <>
              <ModeRow
                title="Gamepad"
                hint="Stick scrolls, A or RT clicks"
                checked={settings.padToggle}
                onChange={(val) => updateSetting('padToggle', val)}
                tip={settings.padToggle ? 'Stop gamepad control' : 'Control the page with a gamepad. Other modes switch off.'}
              />
              <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Gamepad actions">
                {[
                  { key: 'padVActive', label: 'Vertical', icon: 'swap_vert', tip: 'Stick up and down scrolls the page', align: 'start' },
                  { key: 'padHActive', label: 'Sideways', icon: 'swap_horiz', tip: 'Stick left and right scrolls sideways' },
                  { key: 'padClickActive', label: 'Click', icon: 'ads_click', tip: 'A or right trigger clicks the image', align: 'end' },
                ].map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={!!settings[o.key]}
                    onClick={() => updateSetting(o.key, !settings[o.key])}
                    data-tip={o.tip}
                    data-tip-align={o.align}
                    className="key flex-col !h-[58px] !gap-1"
                  >
                    <Icon name={o.icon} size={18} fill={!!settings[o.key]} />
                    <span className="text-[11px]">{o.label}</span>
                  </button>
                ))}
              </div>
              <Segmented
                label="Stick"
                value={settings.padStick}
                onChange={(v) => updateSetting('padStick', v)}
                options={[
                  { value: 'left', label: 'Left stick', tip: 'Scroll with the left stick' },
                  { value: 'right', label: 'Right stick', tip: 'Scroll with the right stick' },
                ]}
              />
              <Slider label="Sensitivity" value={settings.padSens} unit="×" min={1} max={50} onChange={(v) => updateSetting('padSens', v)} />
            </>
          )}
        </section>
      </main>

      {/* Transport */}
      <footer className="px-4 pt-4 pb-4 flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-7">
          <button type="button" onClick={() => manualNav('back')} data-tip={navLabels.back} data-tip-pos="above" aria-label={navLabels.back} className="clay-btn w-11 h-11 rounded-full">
            <Icon name={settings.navToggle ? 'chevron_left' : 'keyboard_arrow_up'} size={22} />
          </button>
          <button
            type="button"
            onClick={togglePause}
            data-state={domeState}
            aria-label={isPaused ? 'Resume' : 'Pause'}
            data-tip={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
            data-tip-pos="above"
            className="dome"
          >
            <Icon name={isPaused ? 'play_arrow' : 'pause'} fill size={30} />
          </button>
          <button type="button" onClick={() => manualNav('forward')} data-tip={navLabels.fwd} data-tip-pos="above" aria-label={navLabels.fwd} className="clay-btn w-11 h-11 rounded-full">
            <Icon name={settings.navToggle ? 'chevron_right' : 'keyboard_arrow_down'} size={22} />
          </button>
        </div>
        <div className="w-full flex items-center justify-between pt-1">
          <button type="button" onClick={openGuide} data-tip="How each mode works, plus keyboard shortcuts" data-tip-pos="above" data-tip-align="start" className="clay-btn h-8 px-3 gap-1.5 rounded-full text-[11px] font-bold">
            <Icon name="menu_book" size={16} />
            Guide &amp; shortcuts
          </button>
          <span className="text-[10px] font-bold text-ink-2 tabular-nums">v{chrome.runtime.getManifest?.().version}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
