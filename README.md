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
| Prone (duck) | Hold ▼ on ground | Hold ↓ |

Hold a direction + ▲ to fire diagonally upward; in mid-air, direction + ▼ fires
diagonally down.

> **Play in landscape** — turn your phone sideways. On portrait the game shows a
> "rotate your phone" prompt and pauses, so the controls have room to breathe.

## 🕹 What's in this build (playable vertical slice)

- A bright cartoon jungle/village level (~4600px): sky with sun & clouds, parallax
  pink & green rolling hills, houses and trees, grassy cobble ground.
- 8-direction shooting, running, jumping, and prone.
- **Five enemy types:** marching soldiers, fixed turrets, fast charging **dogs**,
  hovering **drones** that strafe you, and a **boss** with a health bar.
- **Coins** to collect (with a coin counter) and the **`S`** spread-gun pod
  (kept on respawn).
- Polished HUD: character **portrait**, green **health bar**, coin count, score,
  and a **pause** button (or press **P**).
- **10 lives**, a buffed hero (faster, higher jump, rapid hard-hitting fire,
  4-hit health per life, mercy invulnerability).
- **Sound effects** synthesized in-browser; audio starts on the **Start** tap.
- Big rounded landscape touch controls; portrait shows a "rotate" prompt.

## 🗺 Roadmap (possible next steps)

- More stages and enemy types, additional weapons (Machine gun, Laser).
- Sound effects and music.
- PWA offline support and a real installable Android APK wrapper.

---
Made as a learning/demo project. Not affiliated with Konami; original Contra
assets are not used — all art is generated procedurally in code.
