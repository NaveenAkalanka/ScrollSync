<div align="center">

  <img src="icon.png" alt="ScrollSync Icon" width="100" height="100" />

  # ScrollSync

  **Hands-free browser navigation with auto-scroll, smart click, and gamepad control.**

  <p>
    <a href="#-features">Features</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-controls--shortcuts">Controls</a>
  </p>

  [![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite-5.x-purple.svg)](https://vitejs.dev/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38bdf8.svg)](https://tailwindcss.com/)
  [![Chrome Extension](https://img.shields.io/badge/Manifest-V3-4285F4.svg)](https://developer.chrome.com/docs/extensions/)
  [![License](https://img.shields.io/badge/License-CC_BY_NC_SA_4.0-orange.svg)](LICENSE)
  <br />
  <a href="https://www.buymeacoffee.com/naveenakalanka" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

</div>

<br />

> **Built for flow.** ScrollSync turns long reading sessions, image galleries, and feed browsing into a smooth, low-effort experience with keyboard and controller-first controls.

---

## 🌟 Features

- **↕ Auto Scroll (Vertical + Horizontal)**: Smooth `requestAnimationFrame`-based scrolling with adjustable speed.
- **🧠 Smart Auto Click (Pulse)**: Interval-based click automation with left/center/right targeting for gallery-style navigation.
- **🎮 Gamepad Integration**: Supports controller sticks for scroll direction and button-triggered smart click actions.
- **🪟 Floating On-Page Controls**: Optional draggable floating action icon with quick actions (pause, power, guide).
- **⌨ Keyboard Shortcuts**: Fast runtime control with `Space`, `W`, `S`, `A`, `D`.
- **🧩 Per-Tab State**: Tab-specific configuration managed via background service worker + `chrome.storage.local`.
- **🎨 Custom UI Theme**: Neon-kawaii popup interface built with React + TailwindCSS.

---

## 🛠️ Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite 5
- **Extension Tooling**: `@crxjs/vite-plugin` (Manifest V3 integration)
- **Styling**: Tailwind CSS 3 + custom CSS
- **Runtime APIs**: Chrome Extensions API + Gamepad API
- **Icons**: Phosphor Icons (`@phosphor-icons/react`)

---

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/NaveenAkalanka/ScrollSync.git
   cd ScrollSync
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development**
   ```bash
   npm run dev
   ```

4. **Build for Chrome**
   ```bash
   npm run build
   ```

5. **Load extension in Chrome**
   - Open `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `dist/` folder

---

## 🎛️ Controls & Shortcuts

| Action | Keyboard | Gamepad |
|---|---|---|
| Play / Pause | `Space` | `A / Cross` |
| Increase Speed | `W` | - |
| Decrease Speed | `S` | - |
| Navigate Back | `A` | Left stick flick west |
| Navigate Forward | `D` | Left stick flick east |

---

## 🧱 Project Structure

```text
src/
  background/   # Service worker (state, badge, context menus)
  content/      # Page runtime (scroll, click, gamepad, floating UI)
  App.jsx       # Popup UI
  main.jsx      # Popup entry
manifest.json   # Extension manifest (MV3)
vite.config.mjs # Vite + CRX config
```

---

## 📄 License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)** License.

You are free to:
- **Share** — Copy and redistribute the material in any medium or format.
- **Adapt** — Remix, transform, and build upon the material.

Under the following terms:
- **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made.
- **NonCommercial** — You may not use the material for commercial purposes.
- **ShareAlike** — If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.

See [LICENSE](LICENSE) for the full text.

<br />

<div align="center">
  <p>
    Designed & Developed with ❤️ by <a href="https://github.com/NaveenAkalanka">Naveen Akalanka</a>
    <br />
    <a href="https://www.buymeacoffee.com/naveenakalanka">Support the Project ☕</a>
  </p>
</div>
