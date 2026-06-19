# CONTRA — Jungle Run

A touch-controlled, run-and-gun platformer in the style of Contra, built as a
single self-contained HTML5 game. Pure `<canvas>`, no external assets — all the
pixel art is drawn in code. Runs in any modern mobile or desktop browser.

## ▶ Play it

**On your Android phone (easiest):**

Once GitHub Pages is enabled for this repo (Settings → Pages → Build from the
`claude/contra-android-game-793vex` branch, root folder), open this URL in
Chrome on your phone:

```
https://chicoo-beep.github.io/contra/
```

Tap **Start** and you'll get on-screen touch controls. To play it like an app,
use Chrome's menu → **Add to Home screen**.

**Locally (no install):**

```bash
# from the repo folder
python3 -m http.server 8080
# then open http://localhost:8080 in a browser
```

Or just open `index.html` directly in a browser.

## 🎮 Controls

| Action | Touch | Keyboard |
| ------ | ----- | -------- |
| Move / aim | D-pad | Arrow keys (or WASD) |
| Aim up / down | Hold ▲ / ▼ | ↑ / ↓ |
| Jump | JUMP button | `Z` / Space |
| Fire | FIRE button | `X` |
| Melee hit | HIT button | `C` / right-click |
| Aim / fire (PC) | — | **Mouse** to aim · **left-click** to fire |
| Dash | — | `Shift` |
| Double-jump | tap JUMP again | tap `Z` again in mid-air |
| Prone (duck) | Hold ▼ on ground | Hold ↓ |

Hold a direction + ▲ to fire diagonally upward; in mid-air, direction + ▼ fires
diagonally down.

> **Play in landscape** — turn your phone sideways. On portrait the game shows a
> "rotate your phone" prompt and pauses, so the controls have room to breathe.

## 🕹 What's in this build

- **Real animated pixel-art graphics** (CC0 Pixel Frog art): an animated hero
  (idle/run/jump/fall), animated enemies, spinning fruit "coins", and tiled
  scenic backgrounds — with automatic fallback to the original code-drawn art
  while images load.
- **Three levels** with distinct themes — *Jungle Village* (day), *Sunset Ruins*
  (dusk), and *Midnight Keep* (night) — each ending in a boss. Stats, coins and
  weapons carry over between levels.
- **PC controls:** mouse free-aim with click-to-fire, a **dash** (Shift) with
  i-frames, and a **double-jump**.
- **Health drops** (enemies sometimes drop a heart) and a **saved high score**.
- **Original looping background music** (a synthesized chiptune track per level —
  no copyrighted audio). Toggle with **M**.
- **Beat-'em-up game feel:** a **melee hit** (HIT / `C`) that knocks enemies
  flying, **screen shake** and **freeze-frame hit-stop** on big impacts, enemy
  white-flash + knockback, and a **combo system** (chain kills for a score
  multiplier with on-screen popups).
- **Arena wave fights:** the screen locks and a wave of enemies rushes in —
  clear them to break the barrier and move on.
- Rockets now produce a real **explosive blast** (big splash + shake); the
  **flamethrower has much longer range**.
- 8-direction shooting, running, jumping, and prone.
- **Four weapons** via colored pickup pods: **RIFLE** (default), **`S`** spread,
  **`F`** flamethrower (rapid short-range stream), **`R`** rocket launcher
  (slow, explosive splash damage that clears crowds). No ammo limits.
- **Weapon-switch button** (centre **⟳ WPN**, or key **Q**) cycles through every
  weapon you've collected.
- **God Mode** toggle (top-right **GOD** button, or key **G**) for invincibility.
- **Enemy types:** marching soldiers, tanky **heavies** (5 HP, twin-shot),
  leaping **jumpers**, fixed turrets, hovering **drones**, and a **boss** with a
  health bar on each level — lots of them on screen for a chaotic, road-rage feel.
- Polished HUD: character **portrait**, green **health bar**, coin count, level
  & score, plus a **pause** button (or press **P**).
- **10 lives**, a buffed hero (faster, higher jump, rapid hard-hitting fire,
  4-hit health per life, mercy invulnerability).
- **Sound effects** synthesized in-browser; audio starts on the **Start** tap.
- Big rounded landscape touch controls; portrait shows a "rotate" prompt.

## 🗺 Roadmap (possible next steps)

- More stages and enemy types, additional weapons (Machine gun, Laser).
- Sound effects and music.
- PWA offline support and a real installable Android APK wrapper.

## 🎨 Credits

- Sprite & background art: **"Pixel Adventure" by Pixel Frog**, released under
  **CC0 1.0 (Public Domain)** — https://pixelfrog-assets.itch.io/pixel-adventure-1
  (see `assets/CREDITS.txt`). Music & sound effects are synthesized in-browser.

---
Made as a learning/demo project. Not affiliated with Konami; no original Contra
assets are used.
