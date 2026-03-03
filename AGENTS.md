# ScrollSync Repository Guidelines

This document provides detailed guidelines for agentic coding agents operating in the ScrollSync repository.

---

## 1. Project Overview

**ScrollSync** is a Chrome Extension (Manifest V3) built with React + Vite. It automates web page scrolling and interaction using user-defined speeds, intervals, and external gamepad controllers.

### Tech Stack
- **Frontend:** React 18, TailwindCSS v3
- **Build:** Vite 5 + @crxjs/vite-plugin
- **Icons:** @phosphor-icons/react
- **APIs:** Chrome Extension APIs (Storage, Tabs, Scripting, ContextMenus, Runtime)

---

## 2. Project Structure

```
ScrollSync/
├── src/
│   ├── background/index.js   # Service Worker (state, context menus, IPC)
│   ├── content/index.js      # Content Script (scroll engine, gamepad, floating UI)
│   ├── App.jsx               # Main React Popup UI Component
│   ├── main.jsx              # React Entry Point
│   └── index.css             # Tailwind + Custom Cyber Theme Styles
├── public/                   # Static assets (guide.html, icons)
├── manifest.json             # Extension configuration
├── dist/                    # Production build output (generated)
└── vite.config.mjs
```

---

## 3. Build, Test & Development Commands

| Command | Description |
| :--- | :--- |
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Build production extension to `dist/` |
| `npm run preview` | Preview built frontend bundle locally |

**Loading the Extension:** Run `npm run build`, then Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

**Testing:** No automated tests configured. Validate by running `npm run build` successfully, loading `dist/` in Chrome, and manually verifying popup controls, content-script behavior, keyboard shortcuts, gamepad input, and floating icon.

---

## 4. Code Style Guidelines

### Language & Standards
- **Language:** JavaScript/JSX (ES Modules), React function components with Hooks only
- **Module Type:** `"type": "module"` in package.json
- **Indentation:** 2 spaces (no tabs), max ~100 chars per line

### Naming Conventions
| Type | Convention | Example |
| :--- | :--- | :--- |
| Components | PascalCase | `App`, `FloatingIcon` |
| Functions/variables | camelCase | `updateSetting`, `currentSettings` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_SETTINGS`, `MENU_ID` |
| File names | kebab-case | `index.js`, `app.jsx` |

### Imports Order
```javascript
import React, { useState, useEffect } from 'react';
import { ArrowsDownUp, CursorClick } from "@phosphor-icons/react";
import { scrollToTarget } from './utils/scroll';
import './styles.css';
```

### Type Handling
Plain JavaScript (no TypeScript). Use JSDoc for complex functions:
```javascript
/**
 * Applies scroll movement to the target element
 * @param {Element|null} target - The scrollable element
 * @param {number} speed - Pixels per second
 */
function applyScroll(target, speed) { ... }
```

---

## 5. React Component Guidelines

### Component Structure
```jsx
const ComponentName = () => {
  // 1. State
  const [state, setState] = useState(initialValue);
  // 2. Effects
  useEffect(() => { /* setup */ return () => { /* cleanup */ }; }, []);
  // 3. Handlers
  const handleClick = () => { ... };
  // 4. Render
  return (<div className="...">...</div>);
};
```

### Error Handling
Always wrap async operations and handle Chrome API failures:
```javascript
try {
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("Message failed:", chrome.runtime.lastError.message);
      return;
    }
  });
} catch (e) { console.error("Operation failed:", e); }
```

---

## 6. Content Script Guidelines

### Context Invalidation
Handle extension context invalidation (reloads):
```javascript
function safeSendMessage(message, callback) {
  try {
    if (!chrome.runtime?.id) { handleInvalidContext(); return; }
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError?.message.includes("context invalidated")) {
        handleInvalidContext();
      }
      if (callback) callback(response);
    });
  } catch (e) { handleInvalidContext(); }
}

function handleInvalidContext() {
  isEnabled = false;
  if (animationId) cancelAnimationFrame(animationId);
  // cleanup floating icon, intervals, etc.
}
```

### Animation Loop
- Use `requestAnimationFrame` for smooth scrolling
- Calculate delta time for frame-independent movement
- Clean up with `cancelAnimationFrame` on context invalidation

---

## 7. Background Service Worker Guidelines

- Store per-tab state with keys like `tabState_{tabId}`
- Use `chrome.storage.local` for persistence
- Return `true` from listeners using async operations
- Validate `tabId` before processing (can be invalid/negative)

---

## 8. Styling Guidelines

### Cyber Theme Colors
- Primary: `#00f0ff` (cyan)
- Background: `#050a0e` (dark)
- Alert: `#ff003c` (red)

### Custom CSS Classes
```css
@layer components {
  .cyber-btn {
    @apply relative overflow-hidden font-bold uppercase;
    clip-path: polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%);
  }
}
```

---

## 9. Commit & PR Guidelines

### Commit Prefixes
- `docs: ...` - Documentation changes
- `chore: ...` - General maintenance
- `chore(git): ...` - Git-related changes
- `feat: ...` - New features
- `fix: ...` - Bug fixes

### PR Requirements
- Clear summary of change scope
- List of affected files/modules
- Manual verification steps taken
- Screenshots/GIFs for UI changes

---

## 10. Security & Configuration

- Keep least-privilege permissions in `manifest.json`
- Be careful with `<all_urls>` in `content_scripts.matches`
- **Never commit** secrets, tokens, API keys, or local-only notes

---

## 11. Useful Patterns

### Exclusive Mode (One Active Feature)
```javascript
const updateSetting = (key, value) => {
  const newSettings = { ...settings, [key]: value };
  if (key === 'vToggle' && value) {
    newSettings.hToggle = newSettings.navToggle = newSettings.padToggle = false;
  }
  // ... repeat for other keys
  setSettings(newSettings);
};
```

### Debouncing Settings Sync
```javascript
const saveAndSync = debounce((newSettings) => {
  chrome.runtime.sendMessage({ action: "updateState", ... });
}, 300);
```

---

**End of Guidelines**
