# ScrollSync Design Specification

## 1. Visual Identity & Theme
**Theme Name:** "Neon Kawaii" / Modern Anime Aesthetic  
**Core Aesthetic:** Soft rounded corners, vibrant gradients, high-contrast typography, and glassmorphism (frosted glass effects).

---

## 2. Color Palette
| Purpose | Name | Hex Code | Visual Reference |
| :--- | :--- | :--- | :--- |
| **Primary (Accent)** | Anime Pink | `#FF4D85` | High-energy, main toggle color |
| **Secondary (Accent)** | Anime Purple | `#7B61FF` | Gradient end, interactive elements |
| **Background (Main)** | Soft Snow | `#FDF2F8` | Base background color |
| **Surface (Card)** | Pure White | `#FFFFFF` | Component backgrounds |
| **Text (Heading)** | Slate 900 | `#1E293B` | High legibility headings |
| **Text (Body)** | Slate 600 | `#475569` | Secondary information |
| **Status (Active)** | Emerald | `#10B981` | Success, Active state |
| **Status (Alert)** | Rose | `#F43F5E` | Pause, Error state |

---

## 3. Typography
- **Primary Font:** `Nunito` (Google Fonts)
- **Weights:** 400 (Regular), 600 (Semi-Bold), 700 (Bold), 900 (Black)
- **Hierarchy:**
    - **Header Title:** 20px, Black (900), Gradient fill.
    - **Section Labels:** 10px, Black (900), All-Caps, 0.2em letter spacing.
    - **Value Badges:** 12px, Black (900), Monospace look.

---

## 4. UI Components

### A. Main Container
- **Dimensions:** `320px x 550px`
- **Border Radius:** `32px` (Outer), `24px` (Inner Cards)
- **Border:** `6px` solid White (gives a sticker-like frame effect)
- **Shadow:** `0 20px 50px rgba(0,0,0,0.1)`

### B. Navigation Tabs
- **Style:** Pill-shaped buttons inside a ghost container.
- **Active State:** Linear gradient (`Anime Pink` to `Anime Purple`), white text, `scale(1.05)`.
- **Inactive State:** Slate-400 text, no background, pink-50 hover background.

### C. Custom Toggles (Switches)
- **Track:** `44px x 24px`, rounded-full.
- **Thumb:** `18px x 18px` white circle with subtle shadow.
- **Active State:** Gradient track with `0 0 10px rgba(255, 77, 133, 0.3)` glow.

### D. Control Sliders
- **Track Height:** `10px`
- **Thumb Style:** Large white circle with a 3px border matching the accent color.
- **Interaction:** `scale(1.1)` on hover.

---

## 5. Interaction Design & UX

### A. Feedback Loop
- **Visual Feedback:** When "Smart Click" triggers, a 10px purple dot appears on the page, scales up to 40px, and fades out.
- **Toasts:** Floating black/translucent pill at the top-center of the screen for keyboard shortcut confirmation.

### B. Animations
- **Tab Transitions:** `fade-in` (0.3s) with a `5px` vertical slide.
- **Hover Effects:** All buttons use `transition-all duration-300` and `active:scale-95`.
- **Background Decor:** Two large, low-opacity blurred circles (pink and indigo) in the corners that create a dynamic depth effect.

### C. Floating Icon Component
- **Shape:** 56px Perfect Circle.
- **Style:** White background, 2px border (Status-driven color).
- **Z-Index:** `2147483647` (Topmost).
- **Badge:** Small status circle at the bottom-right of the icon.

---

## 6. Accessibility Patterns
- **Contrast:** High-contrast text on white surfaces (WCAG AA Compliant).
- **Hit targets:** Navigation buttons are minimum 44px height for touch/mouse ease.
- **States:** Interactive elements have distinct `:disabled` states (grayscale + opacity 30%).
