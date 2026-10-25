# 2048 Game (Web Edition)

> 🎮 **Co-developed by Web Claude (Claude Sonnet 5.5) & Antigravity (Google DeepMind)**

A modern, highly polished, zero-dependency browser implementation of the classic **2048** puzzle game.

## ✨ Features

- **Co-designed Architecture**:
  - **Claude Sonnet 5.5**: Core state machine, immutable tile model with persistent IDs, merge & slide algorithms, undo stack.
  - **Antigravity**: ES6+ engine implementation, responsive Glassmorphism UI, Web Audio API procedural sound synthesizer, mobile touch swipe support.
- **Fluid Animations**: Smooth CSS transition matrix tracking each tile's trajectory.
- **Web Audio API Sound Effects**: Procedural sound synthesis (move, merge harmonic chime, tile spawn pop, win fanfare, game over) with mute toggle (`M`).
- **Undo Support**: Full move history rollback with state snapshotting (`U` key or UI button).
- **Persistent High Score**: Saves your highest score and audio preferences via LocalStorage.
- **Full Touch & Keyboard Control**:
  - Desktop: Arrow keys or `W`, `A`, `S`, `D`
  - Mobile/Tablet: Native touch swipe gestures
  - Shortcuts: `U` (Undo), `R` (Restart), `M` (Mute/Unmute)

## 🚀 How to Run Locally

Simply serve the files with any static file server:

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Open `http://localhost:8080` in your browser.

## 📂 Project Structure

- `engine.js` - Zero-dependency ES6+ 2048 game engine and event emitter.
- `app.js` - DOM tile renderer, Web Audio synthesizer, keyboard & touch gesture handlers.
- `index.html` - Clean semantic markup with overlays.
- `style.css` - Responsive layout, CSS grid, glassmorphic styling and animations.
- `test.js` - Automated headless test suite for engine validation.

## 📄 License

MIT
