# ScrollSync Project Context

## Project Overview
ScrollSync is a modern Chrome Extension (Manifest V3) designed for automated page navigation and accessibility. It allows users to control page scrolling (vertical and horizontal), set up "Smart" auto-clickers for galleries, and sync external gamepads for hands-free browsing.

### Key Technologies
- **Frontend:** React 18 with TailwindCSS.
- **Styling:** Custom "Neon Kawaii" theme with glassmorphism and vibrant gradients.
- **Build System:** Vite 5 with `@crxjs/vite-plugin` for seamless manifest integration.
- **Core APIs:** Chrome Extension APIs (Action, Tabs, Scripting, ContextMenus, Runtime) and the Gamepad API.

---

## Building and Running
The project uses standard Node.js scripts defined in `package.json`.

- **Development:** `npm run dev` (Starts Vite dev server for HMR in the popup).
- **Production Build:** `npm run build` (Generates the bundled extension in the `dist/` directory).
- **Installation:**
    1. Run `npm run build`.
    2. Open Chrome and navigate to `chrome://extensions`.
    3. Enable **Developer Mode**.
    4. Click **Load Unpacked** and select the `dist/` folder.

---

## Project Structure
- `src/background/index.js`: The Service Worker. Manages global extension state, context menus, and IPC.
- `src/content/index.js`: The Content Script. Injected into web pages to handle scrolling logic, gamepad polling, and the floating UI.
- `src/App.jsx`: The main React entry point for the popup UI.
- `src/index.css`: Global styles including Tailwind directives and custom scrollbar styling.
- `manifest.json`: Defines permissions (`storage`, `activeTab`, `scripting`, `contextMenus`) and script entry points.

---

## Development Conventions

### 1. State Management & IPC
- The **Background Script** acts as the "source of truth" for tab-specific settings.
- The **Popup** and **Content Scripts** sync with the background using `chrome.runtime.sendMessage`.
- State is intentionally reset on page reload (as per current design) to ensure the extension doesn't run unexpectedly on new pages.

### 2. UI & Styling
- Always use **TailwindCSS** for styling to maintain consistency with the "Neon Kawaii" design spec.
- Prefer **Vanilla CSS** or Tailwind utility classes over external UI libraries to keep the bundle size small.
- Adhere to the `DESIGN_SPEC.md` for color codes (`#FF4D85`, `#7B61FF`) and rounded corners (`32px`/`24px`).

### 3. Execution Logic
- All DOM manipulations and Gamepad polling must live in the `content` script.
- Use `requestAnimationFrame` for scrolling to ensure smooth, high-refresh-rate movement.
- Smart clicking logic should prioritize visible `img` or `canvas` elements.

### 4. Configuration
- When updating `manifest.json`, ensure the Vite config correctly imports it using JSON attributes:
  ```javascript
  import manifest from './manifest.json' with { type: 'json' };
  ```
