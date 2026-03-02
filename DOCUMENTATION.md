# ScrollSync Documentation

## 1. Project Information
**Project Name:** ScrollSync  
**Version:** 1.0.0  
**Type:** Browser Extension (Manifest V3)  
**Core Purpose:** Automates web page scrolling and interaction using user-defined speeds, intervals, and external gamepad controllers. Designed for a "chill" or hands-free browsing experience.

---

## 2. Aims & Objectives
- **Automated Navigation:** Provide hands-free scrolling for long-form articles, social feeds, and image galleries.
- **Accessibility:** Enable users to control their browser using gamepads (Xbox, PlayStation, etc.) instead of a traditional mouse/keyboard.
- **Customization:** Offer fine-grained control over scroll speed, direction, and interaction intervals.
- **Smart Interaction:** Implement "Smart Clicking" logic that identifies the best targets (like gallery "next" buttons) automatically.

---

## 3. System Architecture
The extension follows the standard **Chrome Extension Manifest V3** architecture, integrated with a modern **React + Vite** build pipeline.

### High-Level Architecture
- **UI Layer (Popup):** Built with React 18 and TailwindCSS. The popup is served via `index.html` as defined in manifest.json. Communicates with the background worker to persist state and the content script to apply real-time changes.
- **Control Layer (Background Service Worker):** Acts as the central state manager. Handles context menus, badge updates, and coordinates state across multiple tabs using `chrome.runtime.sendMessage`.
- **Execution Layer (Content Script):** Injected into every page (`<all_urls>`). Performs the actual DOM manipulations, polls for gamepad input using `requestAnimationFrame`, and renders the floating UI.

---

## 4. Directory Structure
```text
ScrollSync/
├── dist/                # Production build output
├── src/
│   ├── background/      # Service Worker (State & Menus)
│   ├── content/        # Page Logic (Scroll & Gamepad)
│   ├── App.jsx         # Main React UI Component
│   ├── main.jsx        # React Entry Point
│   └── index.css       # Tailwind & Global Styles
├── assets/              # Icons and static resources
├── manifest.json        # Extension configuration
├── tailwind.config.js   # Style configuration
├── vite.config.mjs      # Build & Extension bundling config
└── package.json        # Dependencies & scripts
```

---

## 5. System Components & Functions

### A. Static Scrolling (Vertical/Horizontal)
- **Function:** Automatically scrolls the page at a constant pixel-per-second rate.
- **Logic:** Uses `requestAnimationFrame` for smooth sub-pixel scrolling.
- **Optimization:** Dynamically identifies the most "scrollable" element on the page (handling `overflow: auto` containers).

### B. Smart Clicker (Auto-Click)
- **Function:** Simulates clicks at defined intervals (1s to 60s).
- **Intelligence:** Analyzes the viewport for large images or gallery-specific elements to determine the best click position.
- **Modes:** Left, Center, or Right screen positioning.

### C. Gamepad Sync
- **Function:** Maps gamepad sticks and buttons to browser actions.
- **Input:** Uses the `Navigator.getGamepads()` API.
- **Features:**
    - Dual-stick support (selectable Left/Right stick).
    - Sensitivity adjustment.
    - Button-to-click mapping (Face buttons/Triggers).
    - Threshold-based "flick" clicking for navigation.

### D. Floating Controls
- **Function:** A draggable on-page icon providing quick status and access.
- **Feedback:** Changes color/icon based on Pause/Active state.

---

## 6. Technical Stack
- **Framework:** React 18
- **Styling:** TailwindCSS (Custom "Neon Kawaii" theme with glassmorphism)
- **Build Tool:** Vite 5 + @crxjs/vite-plugin
- **Runtime APIs:** Chrome Extension APIs (Storage, Tabs, Scripting, ContextMenus, Action, Runtime) + Gamepad API

---

## 7. Controls & Shortcuts
| Action | Keyboard | Gamepad |
| :--- | :--- | :--- |
| **Play/Pause** | `Space` | `Button 0 (A/Cross)` |
| **Increase Speed** | `W` | — |
| **Decrease Speed** | `S` | — |
| **Navigate Back** | `A` | `Left Stick West` |
| **Navigate Forward**| `D` | `Left Stick East` |

---

## 8. Deployment & Build
To build the extension for production:
```bash
npm run build
```
The resulting `dist/` folder can be loaded into Chrome via **chrome://extensions > Developer Mode > Load Unpacked**.

For development with HMR:
```bash
npm run dev
```
