# Changelog

## 1.1.0

### New
- **Clay design.** Full redesign of the popup, guide, about page and floating hub in a soft neumorphism style: one clay ground, paired light and shadow, and depth as state (running or chosen controls are pressed in).
- **New logo.** The ScrollSync chevrons redrawn on a raised clay disc in pink-to-orange, across the toolbar, store icons, pages and the on-page hub. The original logo is kept in `brand/original/`.
- **Popup pad frame.** The toolbar popup sits on a rounded, raised pad.
- **Animated guide.** Each mode has a looping demo of the real popup UI that shows what to click.
- **Hover help.** Every popup control has a short tip on hover or keyboard focus.
- **Floating hub** now shows the ScrollSync mark with its state (off, paused, running) and stays available while ScrollSync is off.
- **Touch and pen** support for the hub: drag, tap, and long-press for quick actions.

### Fixed
- Floating hub missing on tabs that were open before the extension was installed or reloaded: the popup now re-injects the page script when needed.
- Duplicate floating hubs after an extension reload or re-injection: only one copy runs per page.
- Guide demos sometimes stopping: they now recover after the tab is hidden or the layout changes.
- `S` key no longer flips the scroll direction, and Ctrl / Cmd / Alt shortcuts are left to the browser.

### Platform
- Works on Windows, macOS, Linux and Android Chromium browsers (optional APIs such as context menus and windows are guarded).
- Windows High Contrast and reduced-motion support on every page.
- Fonts and icons are self-hosted, so pages render offline.

## 1.0.0

- First release: auto-scroll, Auto Pulse smart click, gamepad control, floating on-page controls, keyboard shortcuts and per-tab state.
