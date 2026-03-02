import React, { useState, useEffect } from 'react';
import { 
  ArrowsDownUp, 
  ArrowsLeftRight, 
  CursorClick, 
  GameController, 
  Rewind, 
  FastForward,
  AppWindow,
  Sparkle,
  Info,
  Monitor,
  Play,
  Pause,
  ArrowRight
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
    // Exclusive mode logic
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
      className={`kawaii-tab ${activeTab === id ? 'active' : ''}`}
    >
      <Icon size={20} weight={activeTab === id ? "fill" : "bold"} />
      <span>{label}</span>
    </button>
  );

  const Toggle = ({ checked, onChange }) => (
    <label className="kawaii-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="kawaii-slider"></span>
    </label>
  );

  return (
    <div className="w-[320px] min-h-[550px] sticker-frame bg-[#fdf2f8] flex flex-col relative overflow-hidden select-none">
      {/* Background Decor */}
      <div className="bg-decor w-64 h-64 -top-20 -left-20 bg-pink-400" />
      <div className="bg-decor w-64 h-64 -bottom-20 -right-20 bg-indigo-400" />

      {/* Header */}
      <div className="px-6 py-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-xl shadow-sm flex items-center justify-center border border-pink-100">
            <Sparkle size={20} weight="fill" className="text-[#ff4d85]" />
          </div>
          <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-[#ff4d85] to-[#7b61ff] bg-clip-text text-transparent">
            ScrollSync
          </h1>
        </div>
        <div className="flex gap-2 items-center">
            <button onClick={openGuide} className="p-2 text-slate-400 hover:text-[#ff4d85] transition-colors">
                <Info size={20} weight="bold" />
            </button>
            <Toggle checked={isEnabled} onChange={toggleGlobal} />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 mb-4">
          <div className="bg-white/50 backdrop-blur-sm p-1.5 rounded-[24px] flex gap-1 border border-white/50 shadow-sm z-10 relative">
            <TabButton id="v-tab" label="Vert" Icon={ArrowsDownUp} />
            <TabButton id="h-tab" label="Horz" Icon={ArrowsLeftRight} />
            <TabButton id="click-tab" label="Auto" Icon={CursorClick} />
            <TabButton id="pad-tab" label="Pad" Icon={GameController} />
          </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 px-6 pb-6 flex flex-col z-10 transition-all duration-500 ${!isEnabled ? 'opacity-40 grayscale-50 scale-95' : 'opacity-100'}`}>
        <div className="bg-white/90 backdrop-blur-md rounded-[24px] p-5 flex-1 shadow-sm border border-white/60 flex flex-col gap-6">
          
          {activeTab === 'v-tab' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Vertical Scroll</span>
                  <span className="text-xs font-bold text-slate-900">Enable Auto-Pilot</span>
                </div>
                <Toggle checked={settings.vToggle} onChange={(val) => updateSetting('vToggle', val)} />
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase text-[#ff4d85] tracking-widest">Velocity</span>
                  <span className="bg-pink-50 text-[#ff4d85] px-2 py-0.5 rounded-lg text-[10px] font-black border border-pink-100">
                    {settings.vSpeed} px/s
                  </span>
                </div>
                <input type="range" min="0" max="500" value={Math.abs(settings.vSpeed)} onChange={(e) => updateSetting('vSpeed', parseInt(e.target.value))} className="kawaii-range" />
              </div>

              <div className="bg-pink-50/50 p-3 rounded-2xl border border-pink-100 flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                   <ArrowRight size={14} weight="bold" className="text-[#ff4d85]" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-pink-400">Pro Tip</span>
                    <span className="text-[10px] text-pink-600 font-bold">Use [W] / [S] for fast speed sync</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'h-tab' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Horizontal Scroll</span>
                  <span className="text-xs font-bold text-slate-900">Side-to-Side Glide</span>
                </div>
                <Toggle checked={settings.hToggle} onChange={(val) => updateSetting('hToggle', val)} />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase text-[#ff4d85] tracking-widest">Velocity</span>
                  <span className="bg-pink-50 text-[#ff4d85] px-2 py-0.5 rounded-lg text-[10px] font-black border border-pink-100">
                    {settings.hSpeed} px/s
                  </span>
                </div>
                <input type="range" min="0" max="500" value={Math.abs(settings.hSpeed)} onChange={(e) => updateSetting('hSpeed', parseInt(e.target.value))} className="kawaii-range" />
              </div>
            </div>
          )}

          {activeTab === 'click-tab' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Smart Pulse</span>
                  <span className="text-xs font-bold text-slate-900">Auto-Navigator</span>
                </div>
                <Toggle checked={settings.navToggle} onChange={(val) => updateSetting('navToggle', val)} />
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {['left', 'center', 'right'].map(pos => (
                  <button key={pos} onClick={() => updateSetting('navPos', pos)} className={`kawaii-btn ${settings.navPos === pos ? 'active' : ''}`}>
                    {pos}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase text-[#ff4d85] tracking-widest">Pulse Interval</span>
                  <span className="bg-pink-50 text-[#ff4d85] px-2 py-0.5 rounded-lg text-[10px] font-black border border-pink-100">
                    {settings.navInterval} sec
                  </span>
                </div>
                <input type="range" min="1" max="60" value={settings.navInterval} onChange={(e) => updateSetting('navInterval', parseInt(e.target.value))} className="kawaii-range" />
              </div>
            </div>
          )}

          {activeTab === 'pad-tab' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Gamepad Link</span>
                  <span className="text-xs font-bold text-slate-900">Console Experience</span>
                </div>
                <Toggle checked={settings.padToggle} onChange={(val) => updateSetting('padToggle', val)} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[ { key: 'padVActive', label: 'V-Scroll' }, { key: 'padHActive', label: 'H-Scroll' } ].map(mode => (
                  <button key={mode.key} onClick={() => updateSetting(mode.key, !settings[mode.key])} className={`kawaii-btn py-3 ${settings[mode.key] ? 'active' : ''}`}>
                    {mode.label}
                  </button>
                ))}
                <button onClick={() => updateSetting('padClickActive', !settings.padClickActive)} className={`kawaii-btn py-3 col-span-2 ${settings.padClickActive ? 'active' : ''}`}>
                   Smart-Click [A]
                </button>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-2xl border border-white">
                <button onClick={() => updateSetting('padStick', 'left')} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-xl transition-all ${settings.padStick === 'left' ? 'bg-white text-[#ff4d85] shadow-sm' : 'text-slate-400'}`}>Left Stick</button>
                <button onClick={() => updateSetting('padStick', 'right')} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-xl transition-all ${settings.padStick === 'right' ? 'bg-white text-[#ff4d85] shadow-sm' : 'text-slate-400'}`}>Right Stick</button>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1">
                <div className={`w-2 h-2 rounded-full ${padConnected ? 'bg-[#10b981] shadow-[0_0_10px_#10b981] animate-pulse' : 'bg-slate-300'}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${padConnected ? 'text-[#10b981]' : 'text-slate-400'}`}>
                  {padConnected ? "Pad Linked" : "Awaiting Pad"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="px-8 pb-8 pt-2 flex flex-col gap-5 z-10">
        <div className="flex justify-between items-center">
            <button 
              onClick={() => chrome.tabs.sendMessage(tabId, { action: "manualNav", direction: "back" })} 
              className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[#ff4d85] hover:scale-110 active:scale-90 transition-all border border-pink-50"
            >
              <Rewind size={24} weight="fill" />
            </button>
            
            <button onClick={togglePause} className={`morph-btn-kawaii ${isPaused ? 'is-paused' : ''}`}>
              <div className="morph-icon-kawaii">
                {isPaused ? <Play size={28} weight="fill" /> : <Pause size={28} weight="fill" />}
              </div>
            </button>

            <button 
              onClick={() => chrome.tabs.sendMessage(tabId, { action: "manualNav", direction: "forward" })} 
              className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[#ff4d85] hover:scale-110 active:scale-90 transition-all border border-pink-50"
            >
              <FastForward size={24} weight="fill" />
            </button>
        </div>
        
        <div className="flex justify-between items-center px-2">
            <button 
                onClick={() => updateSetting('isFloating', !settings.isFloating)}
                className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${settings.isFloating ? 'text-[#7b61ff]' : 'text-slate-400'}`}
            >
                <Monitor size={14} weight={settings.isFloating ? "fill" : "bold"} />
                {settings.isFloating ? "Float On" : "Float Off"}
            </button>
            <div className="text-[9px] font-black text-slate-300 tracking-[0.2em] uppercase">
                v1.0.0
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
