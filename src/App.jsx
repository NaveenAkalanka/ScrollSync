import React, { useState, useEffect } from 'react';
import { 
  ArrowsDownUp, 
  ArrowsLeftRight, 
  CursorClick, 
  GameController, 
  Rewind, 
  FastForward,
  User,
  Pulse,
  Info,
  Monitor
} from "@phosphor-icons/react";

const App = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState('v-tab');
  const [settings, setSettings] = useState({
    vToggle: false,
    vSpeed: 0,
    hToggle: false,
    hSpeed: 0,
    navToggle: false,
    navPos: 'right',
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
  const [padConnected, setPadConnected] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        setTabId(tab.id);

        chrome.runtime.sendMessage({ action: "getState", tabId: tab.id }, (state) => {
          if (state) {
            setIsEnabled(state.isEnabled);
            setIsPaused(state.isPaused);
            setSettings(state.userSettings);
            if (state.userSettings.activeTab) {
              setActiveTab(state.userSettings.activeTab);
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

    const padInterval = setInterval(() => {
        const activePad = Array.from(navigator.getGamepads()).find(p => p !== null);
        setPadConnected(!!activePad);
    }, 1000);

    return () => {
        chrome.runtime.onMessage.removeListener(messageListener);
        clearInterval(padInterval);
    };
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
    });

    chrome.tabs.sendMessage(tabId, {
      action: 'update',
      isEnabled: e,
      isPaused: p,
      isFloating: s.isFloating,
      scrollV: { active: s.vToggle, speed: s.vSpeed },
      scrollH: { active: s.hToggle, speed: s.hSpeed },
      nav: { active: s.navToggle, position: s.navPos, interval: s.navInterval * 1000 },
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
    if (key === 'vToggle' && value) { newSettings.hToggle = false; newSettings.navToggle = false; newSettings.padToggle = false; }
    if (key === 'hToggle' && value) { newSettings.vToggle = false; newSettings.navToggle = false; newSettings.padToggle = false; }
    if (key === 'navToggle' && value) { newSettings.vToggle = false; newSettings.hToggle = false; newSettings.padToggle = false; }
    if (key === 'padToggle' && value) { newSettings.vToggle = false; newSettings.hToggle = false; newSettings.navToggle = false; }
    
    setSettings(newSettings);
    saveAndSync(newSettings);
  };

  const changeTab = (id) => {
    setActiveTab(id);
    saveAndSync(settings, isEnabled, isPaused, id);
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

  const TabButton = ({ id, label, Icon }) => (
    <button 
      onClick={() => isEnabled && changeTab(id)}
      className={`cyber-tab ${activeTab === id ? 'active' : ''}`}
    >
      <Icon size={18} weight={activeTab === id ? "fill" : "bold"} />
      <span>{label}</span>
    </button>
  );

  const Toggle = ({ checked, onChange }) => (
    <label className="cyber-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="cyber-slider"></span>
    </label>
  );

  return (
    <div className="w-[300px] h-[500px] bg-[#050a0e] flex flex-col overflow-hidden select-none relative border border-[#0f172a]" style={{ width: '300px', height: '500px' }}>
      {/* Glitchy Top Bar */}
      <div className="bg-[#fcee0a] h-1 w-full shrink-0" />
      
      {/* Header */}
      <div className="px-4 py-3 flex justify-between items-center border-b border-[#0f172a] shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center">
            <img src="/icon.svg" className="w-6 h-6" alt="OS" />
          </div>
          <h1 className="font-['Orbitron'] font-black text-xs tracking-tighter text-[#00f0ff]">
            SCROLL_SYNC
          </h1>
        </div>
        <div className="flex gap-2">
            <button onClick={() => chrome.tabs.create({ url: 'about.html' })} title="About" className="p-1 text-[#445b74] hover:text-[#00f0ff] transition-colors">
                <User size={16} weight="bold" />
            </button>
            <button onClick={openGuide} title="Guide" className="p-1 text-[#445b74] hover:text-[#00f0ff] transition-colors">
                <Info size={16} weight="bold" />
            </button>
            <Toggle checked={isEnabled} onChange={toggleGlobal} />
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex bg-[#0a1118] px-4 py-1.5 border-b border-[#0f172a] justify-between items-center shrink-0">
        <div className="flex items-center gap-1.5">
          <Pulse size={10} className={isEnabled ? "text-[#00f0ff]" : "text-[#ff003c]"} />
          <span className={`text-[8px] font-bold uppercase tracking-widest ${isEnabled ? "text-[#00f0ff]" : "text-[#ff003c]"}`}>
            {isEnabled ? (isPaused ? "CORE_HALTED" : "SYSTEM_ACTIVE") : "OFFLINE"}
          </span>
        </div>
        <div className="flex items-center gap-3">
            <button 
              onClick={() => updateSetting('isFloating', !settings.isFloating)}
              className={`flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest transition-colors ${settings.isFloating ? 'text-[#00f0ff]' : 'text-[#445b74]'}`}
            >
                <Monitor size={10} weight={settings.isFloating ? "fill" : "bold"} />
                {settings.isFloating ? "FLOAT_ON" : "FLOAT_OFF"}
            </button>
        </div>
      </div>

      {/* Nav */}
      <div className="flex shrink-0">
        <TabButton id="v-tab" label="Vert" Icon={ArrowsDownUp} />
        <TabButton id="h-tab" label="Horz" Icon={ArrowsLeftRight} />
        <TabButton id="click-tab" label="Auto" Icon={CursorClick} />
        <TabButton id="pad-tab" label="Pad" Icon={GameController} />
      </div>

      {/* Main Content */}
      <div className={`flex-1 p-4 flex flex-col transition-all duration-300 ${!isEnabled ? 'opacity-20 grayscale' : 'opacity-100'}`}>
        <div className="bg-[#0a1118] border border-[#0f172a] p-4 flex-1 relative overflow-y-auto">
          {activeTab === 'v-tab' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-[#445b74]">SCROLL_V_ENGAGED</span>
                <Toggle checked={settings.vToggle} onChange={(val) => updateSetting('vToggle', val)} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[9px] font-bold text-[#00f0ff]">VELOCITY</span>
                  <span className="text-[9px] font-mono text-[#00f0ff]">{settings.vSpeed} PX/S</span>
                </div>
                <input type="range" min="0" max="500" value={Math.abs(settings.vSpeed)} onChange={(e) => updateSetting('vSpeed', parseInt(e.target.value))} className="cyber-range" />
              </div>
            </div>
          )}

          {activeTab === 'h-tab' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-[#445b74]">SCROLL_H_ENGAGED</span>
                <Toggle checked={settings.hToggle} onChange={(val) => updateSetting('hToggle', val)} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[9px] font-bold text-[#00f0ff]">VELOCITY</span>
                  <span className="text-[9px] font-mono text-[#00f0ff]">{settings.hSpeed} PX/S</span>
                </div>
                <input type="range" min="0" max="500" value={Math.abs(settings.hSpeed)} onChange={(e) => updateSetting('hSpeed', parseInt(e.target.value))} className="cyber-range" />
              </div>
            </div>
          )}

          {activeTab === 'click-tab' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-[#445b74]">PULSE_GEN_ACTIVE</span>
                <Toggle checked={settings.navToggle} onChange={(val) => updateSetting('navToggle', val)} />
              </div>
              <div className="grid grid-cols-3 gap-1">
                {['left', 'center', 'right'].map(pos => (
                  <button key={pos} onClick={() => updateSetting('navPos', pos)} className={`cyber-btn py-1 text-[8px] ${settings.navPos === pos ? 'active' : ''}`}>
                    {pos}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[9px] font-bold text-[#00f0ff]">INTERVAL</span>
                  <span className="text-[9px] font-mono text-[#00f0ff]">{settings.navInterval} SEC</span>
                </div>
                <input type="range" min="1" max="60" value={settings.navInterval} onChange={(e) => updateSetting('navInterval', parseInt(e.target.value))} className="cyber-range" />
              </div>
            </div>
          )}

          {activeTab === 'pad-tab' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-[#445b74]">HAPTIC_LINK</span>
                <Toggle checked={settings.padToggle} onChange={(val) => updateSetting('padToggle', val)} />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[ { key: 'padVActive', label: 'V_SCROLL' }, { key: 'padHActive', label: 'H_SCROLL' } ].map(mode => (
                  <button key={mode.key} onClick={() => updateSetting(mode.key, !settings[mode.key])} className={`cyber-btn py-1.5 text-[8px] ${settings[mode.key] ? 'active' : ''}`}>
                    {mode.label}
                  </button>
                ))}
                <button onClick={() => updateSetting('padClickActive', !settings.padClickActive)} className={`cyber-btn py-1.5 text-[8px] col-span-2 ${settings.padClickActive ? 'active' : ''}`}>SMART_CLK</button>
              </div>
              <div className="flex bg-[#050a0e] p-1 border border-[#0f172a]">
                <button onClick={() => updateSetting('padStick', 'left')} className={`flex-1 py-1 text-[8px] font-bold ${settings.padStick === 'left' ? 'bg-[#00f0ff] text-black' : 'text-[#445b74]'}`}>LEFT_S</button>
                <button onClick={() => updateSetting('padStick', 'right')} className={`flex-1 py-1 text-[8px] font-bold ${settings.padStick === 'right' ? 'bg-[#00f0ff] text-black' : 'text-[#445b74]'}`}>RIGHT_S</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 flex flex-col gap-4 shrink-0">
        <div className="flex justify-between items-center px-4">
            <button onClick={() => chrome.tabs.sendMessage(tabId, { action: "manualNav", direction: "back" })} className="p-2 border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10 active:scale-90 transition-all">
              <Rewind size={20} weight="bold" />
            </button>
            <button onClick={togglePause} className={`morph-btn-cyber ${isPaused ? 'is-paused' : ''}`}>
              <div className={`morph-icon-cyber ${isPaused ? 'play' : 'pause'}`} />
            </button>
            <button onClick={() => chrome.tabs.sendMessage(tabId, { action: "manualNav", direction: "forward" })} className="p-2 border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10 active:scale-90 transition-all">
              <FastForward size={20} weight="bold" />
            </button>
        </div>
        <div className="text-[7px] text-center font-bold text-[#445b74] tracking-[0.4em] uppercase">
          {"// NEURAL_LINK_ESTABLISHED //"}
        </div>
      </div>
    </div>
  );
};

export default App;
