/* ============================================================
   CONTRA — Jungle Run
   Touch run-and-gun platformer. Pure canvas, code-drawn art,
   original synthesized music — no external assets.
   ============================================================ */
(function () {
  "use strict";

  const VW = 480, VH = 270;          // logical game units (unchanged)
  const RS = 1.5;                    // render supersample: draw into a 1.5x backing for crisper pixels
  const GROUND_Y = 222;
  const GRAVITY = 0.55;

  const canvas = document.getElementById("screen");
  canvas.width = Math.round(VW * RS); canvas.height = Math.round(VH * RS);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // ============================================================
  //  Sprite assets (CC0 Pixel Frog "Pixel Adventure"). Each sheet
  //  is a horizontal strip of `fw`-wide frames; we slice at draw
  //  time. Everything falls back to code-drawn art until loaded.
  // ============================================================
  const SPRITES = {
    player_idle:   { src: "assets/player_idle.png",   fw: 32 },
    player_run:    { src: "assets/player_run.png",    fw: 32 },
    player_jump:   { src: "assets/player_jump.png",   fw: 32 },
    player_fall:   { src: "assets/player_fall.png",   fw: 32 },
    player_face:   { src: "assets/player_face.png" },   // optional: your photo, drawn on the hero's head
    enemy_soldier: { src: "assets/enemy_soldier.png", fw: 32 },
    enemy_heavy:   { src: "assets/enemy_heavy.png",   fw: 36 },
    enemy_jumper:  { src: "assets/enemy_jumper.png",  fw: 32 },
    enemy_turret:  { src: "assets/enemy_turret.png",  fw: 44 },
    enemy_drone:   { src: "assets/enemy_drone.png",   fw: 32 },
    enemy_charger: { src: "assets/enemy_charger.png",  fw: 52 },
    coin:          { src: "assets/coin.png",          fw: 32 },
    bike:          { src: "assets/bike.png",   detailed: true },
    flycar:        { src: "assets/flycar.png", detailed: true },
    boss:          { src: "assets/boss.png",   detailed: true },
    bg_level1:     { src: "assets/bg_level1.png" },
    bg_level2:     { src: "assets/bg_level2.png" },
    bg_level3:     { src: "assets/bg_level3.png" }
  };
  const IMG = {};
  function loadAssets() {
    for (const k in SPRITES) { const im = new Image(); im.onload = () => { im._ok = true; }; im.src = SPRITES[k].src; IMG[k] = im; }
  }
  loadAssets();
  // Draw frame `idx` of a strip sheet into a box; returns false if image not ready.
  function drawSprite(key, idx, dx, dy, dw, dh, flip) {
    const im = IMG[key]; if (!im || !im._ok || !im.naturalWidth) return false;
    const fw = SPRITES[key].fw || im.naturalWidth, fh = im.naturalHeight;
    const frames = Math.max(1, Math.floor(im.naturalWidth / fw));
    const fi = ((Math.floor(idx) % frames) + frames) % frames;
    dx = Math.round(dx); dy = Math.round(dy);
    if (flip) { ctx.save(); ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(im, fi * fw, 0, fw, fh, 0, 0, dw, dh); ctx.restore(); }
    else ctx.drawImage(im, fi * fw, 0, fw, fh, dx, dy, dw, dh);
    return true;
  }
  // Draw a whole high-res sprite into a box, preserving aspect, smooth-downscaled.
  // anchor: "bottom" aligns base to (cx, by); "center" centers on (cx, by).
  function drawWhole(key, cx, by, targetH, flip, anchor) {
    const im = IMG[key]; if (!im || !im._ok || !im.naturalWidth) return false;
    const aspect = im.naturalWidth / im.naturalHeight, dh = targetH, dw = dh * aspect;
    const dx = Math.round(cx - dw / 2), dy = Math.round(anchor === "center" ? by - dh / 2 : by - dh);
    ctx.imageSmoothingEnabled = true;
    if (flip) { ctx.save(); ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, dw, dh); ctx.restore(); }
    else ctx.drawImage(im, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = false;
    return true;
  }

  function resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    const scale = Math.min(ww / VW, wh / VH);
    canvas.style.width = Math.floor(VW * scale) + "px";
    canvas.style.height = Math.floor(VH * scale) + "px";
  }

  const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  const touchUI = document.getElementById("touch-ui");
  if (isTouch) { touchUI.style.display = "block"; document.body.classList.add("touch"); }
  else document.body.classList.add("show-pause");

  const rotateScreen = document.getElementById("rotate-screen");
  let portraitBlocked = false;
  function checkOrientation() {
    const portrait = window.innerHeight > window.innerWidth;
    portraitBlocked = isTouch && portrait;
    rotateScreen.classList.toggle("show", portraitBlocked);
    if (!portrait && screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {});
  }
  window.addEventListener("resize", () => { resize(); checkOrientation(); });
  window.addEventListener("orientationchange", () => setTimeout(() => { resize(); checkOrientation(); }, 150));
  resize(); checkOrientation();

  // ============================================================
  //  Input
  // ============================================================
  const input = { left: false, right: false, up: false, down: false, jump: false, fire: false, melee: false, dash: false, jumpPressed: false, dashPressed: false };
  const mouse = { x: VW / 2, y: VH / 2, active: false };
  const keyMap = {
    ArrowLeft: "left", ArrowRight: "right", ArrowDown: "down",
    KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down",
    ArrowUp: "jump", KeyZ: "jump", KeyK: "jump", KeyX: "fire", KeyJ: "fire", KeyL: "fire",
    KeyC: "melee", KeyV: "melee", ShiftLeft: "dash", ShiftRight: "dash"
  };
  window.addEventListener("keydown", (e) => {
    if (gameState === "shop") {
      if (e.code === "Digit1") buyItem(0); else if (e.code === "Digit2") buyItem(1);
      else if (e.code === "Digit3") buyItem(2); else if (e.code === "Digit4") buyItem(3);
      else if (e.code === "Enter" || e.code === "Space") continueShop();
      e.preventDefault(); return;
    }
    if (e.code === "KeyP") { togglePause(); return; }
    if (e.code === "KeyM") { toggleMusic(); return; }
    if (e.code === "KeyG") { toggleGod(); return; }
    if (e.code === "KeyQ") { switchWeapon(); return; }
    if (e.code === "KeyE") { e.preventDefault(); throwGrenade(); return; }
    if (e.code === "KeyR") { e.preventDefault(); activateRage(); return; }
    if (e.code === "KeyF") { e.preventDefault(); toggleVehicle(); return; }
    if (e.code === "KeyT") { e.preventDefault(); callAir(); return; }
    const a = keyMap[e.code]; if (!a) return; e.preventDefault();
    if (a === "jump" && !input.jump) input.jumpPressed = true;
    if (a === "dash" && !input.dash) input.dashPressed = true;
    input[a] = true;
  }, { passive: false });
  window.addEventListener("keyup", (e) => { const a = keyMap[e.code]; if (!a) return; e.preventDefault(); input[a] = false; }, { passive: false });

  function bindHold(el, on, off) {
    const start = (e) => { e.preventDefault(); el.classList.add("active"); on(); };
    const end = (e) => { e.preventDefault(); el.classList.remove("active"); off(); };
    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchend", end, { passive: false });
    el.addEventListener("touchcancel", end, { passive: false });
    el.addEventListener("mousedown", start);
    window.addEventListener("mouseup", () => { el.classList.remove("active"); off(); });
  }
  document.querySelectorAll(".ctlbtn[data-key]").forEach((el) => {
    const k = el.dataset.key;
    bindHold(el, () => { if (k === "jump" && !input.jump) input.jumpPressed = true; if (k === "fire") initAudio(); input[k] = true; }, () => { input[k] = false; });
  });
  // tap-style buttons (fire once per press, no hold)
  function bindTap(el, fn) {
    let touched = false;
    el.addEventListener("touchstart", (e) => { e.preventDefault(); touched = true; el.classList.add("active"); fn(); }, { passive: false });
    el.addEventListener("touchend", (e) => { e.preventDefault(); el.classList.remove("active"); }, { passive: false });
    el.addEventListener("click", () => { if (touched) { touched = false; return; } fn(); });
  }
  bindTap(document.getElementById("b-weapon"), switchWeapon);
  bindTap(document.getElementById("god-btn"), toggleGod);
  document.getElementById("pause-btn").addEventListener("click", togglePause);

  // Mouse free-aim + click to fire (PC)
  function mouseToVirtual(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width * VW;
    mouse.y = (e.clientY - r.top) / r.height * VH;
    mouse.active = true;
  }
  canvas.addEventListener("mousemove", mouseToVirtual);
  canvas.addEventListener("mousedown", (e) => {
    mouseToVirtual(e); initAudio();
    if (e.button === 0) input.fire = true;
    else if (e.button === 2) input.melee = true;
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) input.fire = false;
    else if (e.button === 2) input.melee = false;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // ============================================================
  //  Audio core
  // ============================================================
  let actx = null, masterGain = null, musicGain = null, soundOn = true;
  function initAudio() {
    if (actx) { if (actx.state === "suspended") actx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { soundOn = false; return; }
    actx = new AC();
    masterGain = actx.createGain(); masterGain.gain.value = 0.5; masterGain.connect(actx.destination);
    musicGain = actx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(actx.destination);
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!soundOn || !actx) return;
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = type || "square"; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol == null ? 0.25 : vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, ff) {
    if (!soundOn || !actx) return;
    const t = actx.currentTime, n = Math.floor(actx.sampleRate * dur);
    const buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = actx.createBufferSource(); src.buffer = buf;
    const f = actx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = ff || 1200;
    const g = actx.createGain(); g.gain.value = vol == null ? 0.4 : vol;
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(masterGain); src.start(t); src.stop(t + dur);
  }
  const SFX = {
    shoot:   () => tone(820, 0.07, "square", 0.15, 360),
    spread:  () => { tone(700, 0.08, "sawtooth", 0.13, 320); tone(520, 0.08, "square", 0.09, 240); },
    flame:   () => noise(0.07, 0.10, 1600),
    rocket:  () => { tone(180, 0.18, "sawtooth", 0.2, 520); noise(0.12, 0.12, 1400); },
    melee:   () => { tone(420, 0.06, "square", 0.16, 180); noise(0.06, 0.16, 2600); },
    jump:    () => tone(320, 0.16, "square", 0.18, 680),
    hit:     () => noise(0.08, 0.20, 2200),
    explode: () => { noise(0.35, 0.45, 900); tone(160, 0.3, "sawtooth", 0.18, 50); },
    coin:    () => { tone(988, 0.06, "square", 0.18); setTimeout(() => tone(1319, 0.10, "square", 0.18), 60); },
    swap:    () => tone(660, 0.05, "square", 0.16, 920),
    power:   () => { tone(523, 0.09, "square", 0.2); setTimeout(() => tone(784, 0.12, "square", 0.2), 90); setTimeout(() => tone(1046, 0.14, "square", 0.2), 200); },
    hurt:    () => { tone(220, 0.3, "sawtooth", 0.28, 70); noise(0.2, 0.28, 700); },
    bossHit: () => tone(120, 0.06, "square", 0.16, 90),
    bossDie: () => { noise(0.8, 0.55, 700); tone(90, 0.7, "sawtooth", 0.32, 40); },
    over:    () => { tone(330, 0.25, "square", 0.22, 220); setTimeout(() => tone(247, 0.25, "square", 0.22, 160), 220); setTimeout(() => tone(165, 0.5, "square", 0.22, 90), 460); },
    fanfare: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.16, "square", 0.22), i * 110)); }
  };

  // ============================================================
  //  Background music — original looping chiptune
  // ============================================================
  const HZ = {
    C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, AS2: 116.54, B2: 123.47,
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, AS4: 466.16, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46
  };
  const Z = 0;
  const MUSIC = {
    1: { stepDur: 0.214, steps: [
      [HZ.A2, HZ.A4], [Z, HZ.C5], [HZ.A2, HZ.E5], [Z, HZ.C5],
      [HZ.F2, HZ.A4], [Z, HZ.C5], [HZ.F2, HZ.F4], [Z, HZ.C5],
      [HZ.C3, HZ.C5], [Z, HZ.E5], [HZ.C3, HZ.G4], [Z, HZ.E5],
      [HZ.G2, HZ.B4], [Z, HZ.D5], [HZ.G2, HZ.G4], [Z, HZ.D5]
    ] },
    2: { stepDur: 0.188, steps: [
      [HZ.D2, HZ.D5], [Z, HZ.F4], [HZ.D2, HZ.A4], [Z, HZ.F4],
      [HZ.AS2, HZ.AS4], [Z, HZ.D5], [HZ.AS2, HZ.F4], [Z, HZ.D5],
      [HZ.F2, HZ.C5], [Z, HZ.A4], [HZ.F2, HZ.F4], [Z, HZ.A4],
      [HZ.C3, HZ.E5], [Z, HZ.C5], [HZ.C3, HZ.G4], [Z, HZ.C5]
    ] },
    3: { stepDur: 0.166, steps: [   // E-minor driving, fast & tense
      [HZ.E2, HZ.E5], [Z, HZ.G4], [HZ.E2, HZ.B4], [Z, HZ.G4],
      [HZ.C3, HZ.C5], [Z, HZ.E5], [HZ.C3, HZ.G4], [Z, HZ.E5],
      [HZ.G2, HZ.B4], [Z, HZ.D5], [HZ.G2, HZ.G4], [Z, HZ.D5],
      [HZ.D2, HZ.A4], [Z, HZ.F4], [HZ.D2, HZ.D5], [Z, HZ.F4]
    ] }
  };
  let musicPlaying = false, musicOn = true, musicStep = 0, nextNoteTime = 0, musicInterval = null;
  function mOsc(freq, start, dur, type, vol) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(musicGain); o.start(start); o.stop(start + dur + 0.02);
  }
  function mNoise(start, dur, vol, ff) {
    const n = Math.floor(actx.sampleRate * dur), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = actx.createBufferSource(); src.buffer = buf;
    const f = actx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = ff || 5000;
    const g = actx.createGain(); g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f); f.connect(g); g.connect(musicGain); src.start(start); src.stop(start + dur);
  }
  function mKick(start) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(135, start); o.frequency.exponentialRampToValueAtTime(48, start + 0.12);
    g.gain.setValueAtTime(0.45, start); g.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
    o.connect(g); g.connect(musicGain); o.start(start); o.stop(start + 0.16);
  }
  function playStep(s, t) {
    const pat = MUSIC[level], st = pat.steps[s];
    if (st[0]) mOsc(st[0], t, pat.stepDur * 1.9, "triangle", 0.22);
    if (st[1]) mOsc(st[1], t, pat.stepDur * 0.85, "square", 0.10);
    if (s % 4 === 0) mKick(t);
    if (s === 4 || s === 12) mNoise(t, 0.12, 0.10, 3500);
    if (s % 2 === 1) mNoise(t, 0.03, 0.04, 9000);
  }
  function musicTick() {
    if (!actx || !musicPlaying) return;
    if (!musicOn || gameState !== "playing" || portraitBlocked) { nextNoteTime = actx.currentTime + 0.06; return; }
    while (nextNoteTime < actx.currentTime + 0.12) {
      playStep(musicStep, nextNoteTime);
      nextNoteTime += MUSIC[level].stepDur;
      musicStep = (musicStep + 1) % 16;
    }
  }
  function startMusic() {
    if (!actx || musicPlaying) return;
    musicPlaying = true; musicStep = 0; nextNoteTime = actx.currentTime + 0.1;
    musicInterval = setInterval(musicTick, 25);
  }
  function toggleMusic() { musicOn = !musicOn; if (musicGain) musicGain.gain.value = musicOn ? 0.32 : 0; }

  // ============================================================
  //  Weapons
  // ============================================================
  const WEAPONS = {
    default: { cd: 4,  name: "RIFLE" },
    spread:  { cd: 6,  name: "SPREAD" },
    flame:   { cd: 2,  name: "FLAME" },
    rocket:  { cd: 22, name: "ROCKET" }
  };
  const PICKUP_WEAPON = { S: "spread", F: "flame", R: "rocket" };

  // ============================================================
  //  Level data
  // ============================================================
  const LEVELS = {
    1: {
      w: 4600, name: "JUNGLE VILLAGE", fireMul: 1, bossHp: 56,
      theme: { skyTop: "#7ec7f5", skyMid: "#aee0f7", skyBot: "#e9d9c7", sun: "#fff3c4",
               hillFar: "#d98fb0", hillNear: "#7cc05a", ground: "#6b4a2c", grass: "#4caf3f",
               cobble: "#5a3d24", roof1: "#5a6fb0", wall1: "#e8e3d4", roof2: "#7a4a8c", wall2: "#efe6d6",
               trunk: "#6b4a2a", leaf1: "#3f8f3a", leaf2: "#4fa84a" },
      platforms: [[360,172,90,10],[560,140,80,10],[720,178,100,10],[980,150,90,10],[1180,120,80,10],[1360,175,110,10],[1680,160,90,10],[1880,128,80,10],[2080,170,100,10],[2380,150,90,10],[2620,175,110,10],[2960,145,90,10],[3200,175,120,10],[3500,150,90,10],[3760,170,110,10]],
      soldiers: [430,700,1000,1300,1600,1950,2300,2650,3000,3350,3700,4000],
      heavies:  [1150,2200,3250,3900],
      jumpers:  [820,1500,2050,2800,3450],
      turrets:  [[720,162],[1360,159],[2080,154],[2620,159],[3760,154]],
      drones:   [[600,80],[1000,92],[1400,80],[1800,95],[2200,82],[2600,88],[3000,80],[3400,92],[3800,84]],
      coinSpots:[200,470,760,1020,1300,1560,1820,2120,2420,2700,3000,3300,3560,3820,4080],
      pickups:  [[600,110,"S"],[1500,150,"F"],[2800,150,"R"]],
      arenas:   [{ x: 1450, count: 7, types: ["soldier","jumper","heavy"] }, { x: 3050, count: 8, types: ["soldier","heavy","jumper","drone"] }],
      vehicles: [[760, "bike"], [2350, "flycar"]]
    },
    2: {
      w: 4900, name: "SUNSET RUINS", fireMul: 0.72, bossHp: 88,
      theme: { skyTop: "#3b2a55", skyMid: "#c0567a", skyBot: "#f2a45c", sun: "#ffe2a0",
               hillFar: "#6a3f70", hillNear: "#8a4a55", ground: "#7a5230", grass: "#caa24a",
               cobble: "#5e3c22", roof1: "#4a3a6a", wall1: "#cdbfa6", roof2: "#7a3a4a", wall2: "#d8c4a8",
               trunk: "#5a3a24", leaf1: "#7a8a3a", leaf2: "#94a44a" },
      platforms: [[300,160,90,10],[520,130,80,10],[700,170,90,10],[900,140,90,10],[1120,165,100,10],[1340,120,80,10],[1560,160,90,10],[1820,135,90,10],[2040,170,100,10],[2300,140,90,10],[2540,165,100,10],[2820,130,80,10],[3060,170,110,10],[3340,145,90,10],[3600,165,100,10],[3900,140,90,10],[4150,170,110,10]],
      soldiers: [360,640,920,1200,1480,1760,2040,2320,2600,2880,3160,3440,3720,4000,4300],
      heavies:  [1000,1900,2750,3600,4200],
      jumpers:  [700,1350,2100,2900,3500,4050],
      turrets:  [[700,154],[1340,104],[2040,154],[2820,114],[3600,149],[4150,154]],
      drones:   [[450,80],[1000,90],[1500,80],[1950,95],[2400,82],[2900,88],[3400,80],[3850,92],[4250,84],[2200,70],[3100,72]],
      coinSpots:[250,560,880,1200,1520,1840,2160,2480,2800,3120,3440,3760,4080,4350,4600],
      pickups:  [[520,100,"F"],[2300,110,"R"],[3500,150,"S"]],
      arenas:   [{ x: 1550, count: 8, types: ["soldier","heavy","jumper"] }, { x: 3300, count: 9, types: ["soldier","heavy","drone","jumper"] }],
      vehicles: [[700, "bike"], [2500, "flycar"]]
    },
    3: {
      w: 5200, name: "MIDNIGHT KEEP", fireMul: 0.6, bossHp: 120,
      theme: { skyTop: "#0d1330", skyMid: "#26305e", skyBot: "#4a4a78", sun: "#cfe0ff",
               hillFar: "#2a2f55", hillNear: "#33406a", ground: "#2f3550", grass: "#5a6aa0",
               cobble: "#262b42", roof1: "#3a3a64", wall1: "#b8b8d0", roof2: "#5a2f5a", wall2: "#c4b0c8",
               trunk: "#3a3550", leaf1: "#3a5a6a", leaf2: "#4a6f80" },
      platforms: [[300,160,90,10],[520,128,80,10],[720,168,90,10],[940,138,90,10],[1160,165,100,10],[1380,118,80,10],[1600,158,90,10],[1860,132,90,10],[2080,168,100,10],[2340,138,90,10],[2580,162,100,10],[2860,126,80,10],[3100,168,110,10],[3380,142,90,10],[3640,162,100,10],[3940,136,90,10],[4200,168,110,10],[4480,140,90,10],[4720,166,100,10]],
      soldiers: [340,620,900,1180,1460,1740,2020,2300,2580,2860,3140,3420,3700,3980,4260,4540,4760],
      heavies:  [980,1880,2780,3680,4400,4820],
      jumpers:  [680,1320,2060,2880,3500,4100,4680],
      turrets:  [[720,152],[1380,102],[2080,152],[2860,110],[3640,146],[4480,124],[4720,150]],
      drones:   [[420,80],[980,90],[1500,78],[1980,92],[2440,80],[2920,86],[3400,78],[3880,90],[4300,82],[2200,66],[3200,70],[4000,68]],
      coinSpots:[260,580,900,1220,1540,1860,2180,2500,2820,3140,3460,3780,4100,4420,4740,4980],
      pickups:  [[520,96,"R"],[2200,108,"F"],[3700,150,"S"]],
      arenas:   [{ x: 1500, count: 9, types: ["soldier","heavy","jumper","drone"] }, { x: 3000, count: 10, types: ["soldier","heavy","jumper","drone"] }, { x: 4300, count: 11, types: ["heavy","soldier","drone","jumper"] }],
      vehicles: [[720, "bike"], [2600, "flycar"], [3900, "bike"]]
    }
  };
  const LAST_LEVEL = 3;

  // ============================================================
  //  State & helpers
  // ============================================================
  let player, bullets, eBullets, enemies, particles, pickups, coins, platforms, boss;
  let camX, score, lives, coinCount, shootCD, flashT, frame, gameState;
  let level, levelW, theme, fireMul, bannerT, pendingAdvance, godMode = false;
  // juice / beat-'em-up state
  let shake = 0, hitStop = 0, meleeCD = 0, combo = 0, comboTimer = 0, meleeFx = null;
  let popups = [], blasts = [], drops = [], grenades = [];
  let vehicleParked = [], airJet = null;
  let bonusHpMax = 0, fireRateMul = 1, dashCdBase = 38;   // persistent shop upgrades
  let rage = 0, berserk = 0, smashCD = 0, grenadeCD = 0, pendingShop = false;
  let hiScore = 0;
  try { hiScore = parseInt(localStorage.getItem("contra_hi") || "0", 10) || 0; } catch (e) {}
  function saveHi() { if (score > hiScore) { hiScore = score; try { localStorage.setItem("contra_hi", String(hiScore)); } catch (e) {} } }
  let arenas = [], arenaActive = false, curArena = null, arenaLeft = 0, arenaTimer = 0;
  function addShake(n) { if (n > shake) shake = n; }
  function addPopup(x, y, text, color, big) { popups.push({ x, y, text, color: color || "#fff", t: 46, vy: -0.7, big: !!big }); }

  const STARS = [];
  for (let i = 0; i < 60; i++) STARS.push({ x: Math.random() * VW * 1.2, y: Math.random() * 160, p: Math.random() * 6.28, s: Math.random() < 0.25 ? 2 : 1 });

  function rect(x, y, w, h) { return { x, y, w, h }; }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  function makePlayer() {
    const hpMax = 4 + bonusHpMax;
    return { x: 40, y: GROUND_Y - 30, w: 14, h: 30, vx: 0, vy: 0, facing: 1,
      onGround: false, prone: false, weapon: "default", owned: ["default"], invuln: 0, hp: hpMax, hpMax: hpMax,
      jumps: 2, dashCD: 0, dashTimer: 0, grenades: 3, airstrikes: 2, vehicle: null };
  }
  function vehSize(t) { return t === "flycar" ? { w: 48, h: 24 } : { w: 44, h: 26 }; }
  function switchWeapon() {
    if (!player || player.owned.length < 2) return;
    const i = player.owned.indexOf(player.weapon);
    player.weapon = player.owned[(i + 1) % player.owned.length];
    SFX.swap();
  }
  function toggleGod() {
    godMode = !godMode;
    const b = document.getElementById("god-btn"); if (b) b.classList.toggle("on", godMode);
    if (godMode && player) player.invuln = 0;
  }
  function makeSoldier(x) { return { type: "soldier", x, y: GROUND_Y - 26, w: 14, h: 26, vx: 0, vy: 0, hp: 1, fireCD: (60 + Math.random() * 90) * fireMul, alive: true, active: false }; }
  function makeHeavy(x)   { return { type: "heavy", x, y: GROUND_Y - 30, w: 18, h: 30, vx: 0, vy: 0, hp: 5, fireCD: (70 + Math.random() * 40) * fireMul, alive: true, active: false }; }
  function makeJumper(x)  { return { type: "jumper", x, y: GROUND_Y - 22, w: 14, h: 22, vx: 0, vy: 0, hp: 2, jumpCD: 30 + Math.random() * 50, alive: true, active: false }; }
  function makeTurret(x, y) { return { type: "turret", x, y, w: 18, h: 16, hp: 3, fireCD: 90 * fireMul, alive: true, active: false }; }
  function makeDrone(x, y) { return { type: "drone", x, y, baseY: y, w: 22, h: 14, hp: 2, fireCD: (80 + Math.random() * 50) * fireMul, t: Math.random() * 6, alive: true, active: false }; }
  function makeCharger(x) { return { type: "charger", x, y: GROUND_Y - 22, w: 24, h: 22, vx: 0, vy: 0, hp: 3, chargeT: 0, alive: true, active: false }; }
  function makeBoss(hp) { return { x: levelW - 150, y: GROUND_Y - 84, w: 60, h: 84, hp, hpMax: hp, fireCD: 70, alive: true, active: false, coreT: 0, pulse: 0, phase: 0 }; }

  function loadLevel(n) {
    level = n;
    const L = LEVELS[n];
    levelW = L.w; theme = L.theme; fireMul = L.fireMul;
    platforms = L.platforms.map((p) => rect(p[0], p[1], p[2], p[3]));
    enemies = [];
    L.soldiers.forEach((x) => enemies.push(makeSoldier(x)));
    (L.heavies || []).forEach((x) => enemies.push(makeHeavy(x)));
    (L.jumpers || []).forEach((x) => enemies.push(makeJumper(x)));
    L.turrets.forEach((t) => enemies.push(makeTurret(t[0], t[1])));
    // ground-only: former flyer positions become charging Rinos
    L.drones.forEach((d) => enemies.push(makeCharger(d[0])));
    coins = [];
    L.coinSpots.forEach((sx) => { for (let i = 0; i < 5; i++) coins.push({ x: sx + i * 18, y: 150 - Math.sin((i / 4) * Math.PI) * 34, taken: false, t: i }); });
    pickups = L.pickups.map((p) => ({ x: p[0], y: p[1], w: 16, h: 16, kind: p[2], t: 0 }));
    boss = makeBoss(L.bossHp);
    bullets = []; eBullets = []; particles = []; popups = []; blasts = []; drops = []; meleeFx = null;
    arenas = (L.arenas || []).map((a) => ({ x: a.x, count: a.count, types: a.types, triggered: false, done: false }));
    arenaActive = false; curArena = null; arenaTimer = 0; grenades = []; grenadeCD = 0; airJet = null; berserk = 0; smashCD = 0;
    vehicleParked = (L.vehicles || []).map((v) => { const s = vehSize(v[1]); return { type: v[1], x: v[0], y: v[1] === "flycar" ? 150 : GROUND_Y - s.h, w: s.w, h: s.h, hp: v[1] === "bike" ? 6 : 5, hpMax: v[1] === "bike" ? 6 : 5 }; });
    player.x = 40; player.y = GROUND_Y - 30; player.vx = 0; player.vy = 0; player.prone = false;
    player.vehicle = null; player.w = 14; player.h = 30;
    player.hpMax = 4 + bonusHpMax; player.hp = player.hpMax; player.invuln = 100; player.grenades = 3; player.airstrikes = 2;
    camX = 0; shootCD = 0; meleeCD = 0; bannerT = 130;
  }
  function resetGame() {
    bonusHpMax = 0; fireRateMul = 1; dashCdBase = 38; rage = 0; berserk = 0; smashCD = 0; pendingShop = false;
    player = makePlayer();
    score = 0; lives = 10; coinCount = 0; flashT = 0; frame = 0; pendingAdvance = false;
    shake = 0; hitStop = 0; combo = 0; comboTimer = 0;
    loadLevel(1);
  }
  function advanceLevel() { SFX.fanfare(); loadLevel(level + 1); }

  // ============================================================
  //  Combat
  // ============================================================
  function aimVector() {
    if (mouse.active) {   // free 360° aim toward cursor (PC)
      const pcx = player.x + player.w / 2 - camX, pcy = player.y + 12;
      const dx = mouse.x - pcx, dy = mouse.y - pcy;
      if (Math.abs(dx) > 2) player.facing = dx < 0 ? -1 : 1;
      return { dx, dy };
    }
    let dx = player.facing, dy = 0;
    const up = input.up, down = input.down && !player.onGround;
    if (up && (input.left || input.right)) { dx = player.facing; dy = -1; }
    else if (up) { dx = 0; dy = -1; }
    else if (down) { dx = player.facing; dy = 1; }
    return { dx, dy };
  }
  function firePlayer() {
    const w = player.weapon, { dx, dy } = aimVector();
    const mag = Math.hypot(dx, dy) || 1, ux = dx / mag, uy = dy / mag;
    const mx = player.x + player.w / 2 + ux * 9, my = player.y + (player.prone ? player.h - 6 : 10);
    if (w === "spread") {
      const sp = 6.6, base = Math.atan2(uy, ux);
      for (let a = -2; a <= 2; a++) { const ang = base + a * 0.16; bullets.push({ kind: "bullet", x: mx, y: my, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 3, dmg: 2, spread: true }); }
      SFX.spread();
    } else if (w === "flame") {
      const sp = 6.4, base = Math.atan2(uy, ux);   // longer reach
      for (let i = 0; i < 3; i++) { const ang = base + (Math.random() - 0.5) * 0.34, s = sp * (0.82 + Math.random() * 0.4); bullets.push({ kind: "flame", x: mx, y: my, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, r: 3, dmg: 1, life: 30 }); }
      SFX.flame();
    } else if (w === "rocket") {
      const sp = 5.2; bullets.push({ kind: "rocket", x: mx, y: my, vx: ux * sp, vy: uy * sp, r: 6, dmg: 14 });
      SFX.rocket();
    } else {
      const sp = 6.6; bullets.push({ kind: "bullet", x: mx, y: my, vx: ux * sp, vy: uy * sp, r: 3, dmg: 2, spread: false });
      SFX.shoot();
    }
    shootCD = Math.max(1, Math.round(WEAPONS[w].cd * fireRateMul));
  }
  function enemyShoot(ex, ey, tx, ty, speed) { const ang = Math.atan2(ty - ey, tx - ex); eBullets.push({ x: ex, y: ey, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 3 }); }
  function bShot(x, y, ang, sp) { return { x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 4 }; }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 18 + Math.random() * 14, color }); }
  }
  function killReward(e) {
    const base = e.type === "turret" ? 300 : e.type === "drone" ? 200 : e.type === "heavy" ? 250 : 100;
    combo++; comboTimer = 130;
    const mult = Math.min(combo, 12);
    score += base * mult;
    addPopup(e.x + e.w / 2, e.y - 2, combo >= 2 ? "+" + (base * mult) : "+" + base, combo >= 3 ? "#ffd23f" : "#fff", combo >= 4);
    burst(e.x + e.w / 2, e.y + e.h / 2, "#ff8c3f", 18); burst(e.x + e.w / 2, e.y + e.h / 2, "#ffd23f", 8);
    addShake(3); SFX.explode();
    if (berserk <= 0) rage = Math.min(100, rage + 8);
    if (Math.random() < 0.12) drops.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vy: -2, kind: "heart", t: 0 });
  }
  function hurtEnemy(e, dmg) { if (!e.alive) return; e.hp -= dmg; e.flash = 6; if (e.hp <= 0) { e.alive = false; killReward(e); } else SFX.hit(); }
  function hurtBoss(dmg) {
    if (!boss.alive) return;
    boss.hp -= dmg; boss.pulse = 6; score += Math.ceil(dmg); SFX.bossHit();
    if (boss.hp <= 0) {
      boss.alive = false; burst(boss.x + 28, boss.y + 40, "#ff5a3c", 60); score += 2000; addShake(12); SFX.bossDie();
      if (level < LAST_LEVEL) pendingShop = true;        // open the shop at end of frame, then next level
      else { gameState = "win"; saveHi(); SFX.fanfare(); showOverlay("win-screen", "win-score", "SCORE " + score + "   BEST " + Math.max(hiScore, score)); }
    }
  }
  function explodeAt(x, y, radius, dmg) {
    blasts.push({ x, y, r: 6, max: radius + 6, t: 16 });
    burst(x, y, "#ffb13f", 34); burst(x, y, "#ffec80", 20); burst(x, y, "#ff5a3c", 16);
    addShake(10); hitStop = Math.max(hitStop, 3); SFX.explode();
    for (const e of enemies) {
      if (!e.alive) continue;
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2, d = dist(ecx, ecy, x, y);
      if (d < radius) { e.kbx = (ecx < x ? -1 : 1) * (7 - d / radius * 4); e.vy = -3.5; hurtEnemy(e, dmg); }
    }
    if (boss.alive && boss.active && dist(boss.x + boss.w / 2, boss.y + boss.h / 2, x, y) < radius + 22) hurtBoss(dmg);
  }
  function spawnEnemyByType(t, x) {
    if (t === "heavy") return makeHeavy(x);
    if (t === "jumper") return makeJumper(x);
    if (t === "charger" || t === "drone") return makeCharger(x);   // ground-only now
    return makeSoldier(x);
  }
  function triggerArena(a) {
    arenaActive = true; curArena = a; a.triggered = true; arenaTimer = 0;
    arenaLeft = Math.max(0, Math.min(camX, levelW - VW));
    for (let i = 0; i < a.count; i++) {
      const fromRight = i % 2 === 0;
      const ex = fromRight ? arenaLeft + VW + 12 + i * 9 : arenaLeft - 22 - i * 9;
      const e = spawnEnemyByType(a.types[i % a.types.length], ex);
      e.arena = true; e.active = true; enemies.push(e);
    }
    addShake(7); SFX.bossHit(); addPopup(arenaLeft + VW / 2, 64, "CLEAR THE AREA!", "#ffd23f", true);
  }
  function doMelee() {
    if (berserk > 0) { doSmash(false); meleeCD = 8; return; }   // berserk melee = ground-pound
    meleeCD = 15; SFX.melee();
    const p = player, reach = 26;
    const mx = p.facing > 0 ? p.x + p.w : p.x - reach;
    const box = rect(mx, p.y, reach, p.h);
    let hit = false;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (overlap(box, e)) { e.kbx = p.facing * 7.5; e.vy = -4.2; e.flash = 8; burst(e.x + e.w / 2, e.y + e.h / 2, "#ffffff", 12); hurtEnemy(e, 4); hit = true; }
    }
    if (boss.alive && boss.active && overlap(box, boss)) { hurtBoss(5); hit = true; }
    meleeFx = { x: p.facing > 0 ? p.x + p.w : p.x, y: p.y + p.h / 2 - 4, t: 8, f: p.facing };
    if (hit) { hitStop = Math.max(hitStop, 4); addShake(6); }
  }
  function throwGrenade() {
    if (gameState !== "playing" || player.grenades <= 0 || grenadeCD > 0) return;
    player.grenades--; grenadeCD = 16;
    grenades.push({ x: player.x + player.w / 2, y: player.y + 6, vx: player.facing * 4.4 + player.vx * 0.4, vy: -5.4, fuse: 72 });
    SFX.rocket();
  }
  function activateRage() {
    if (gameState !== "playing" || rage < 100 || berserk > 0 || player.vehicle) return;
    rage = 0; berserk = 420;                 // ~7 seconds of fury
    player.invuln = Math.max(player.invuln, 40);
    addShake(12); flashT = 10; SFX.bossDie();
    addPopup(player.x + 7, player.y - 6, "BERSERK!", "#7CFC00", true);
    doSmash(true);                            // open with a shockwave
  }
  function doSmash(initial) {
    if (smashCD > 0 && !initial) return;
    smashCD = 26;
    const cx = player.x + player.w / 2, cy = player.y + player.h;
    blasts.push({ x: cx, y: cy, r: 8, max: 100, t: 20 });
    burst(cx, cy, "#c7f5a0", 30); burst(cx, cy, "#a0e070", 18); burst(cx, cy, "#dfeecf", 16);
    addShake(14); hitStop = Math.max(hitStop, 5); SFX.bossDie();
    for (const e of enemies) {
      if (!e.alive) continue;
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      if (dist(ecx, cy, cx, cy) < 100 && Math.abs(ecy - cy) < 70) {
        e.kbx = (ecx < cx ? -1 : 1) * 9; e.vy = -6; e.flash = 8; hurtEnemy(e, 6);
      }
    }
    if (boss.alive && boss.active && dist(boss.x + boss.w / 2, cy, cx, cy) < 130) hurtBoss(14);
  }
  // ---- vehicles (rideable, weaponized) ----
  function toggleVehicle() {
    if (gameState !== "playing") return;
    if (player.vehicle) { dismountVehicle(false); return; }
    for (const v of vehicleParked) {
      if (overlap(player, { x: v.x - 18, y: v.y - 18, w: v.w + 36, h: v.h + 36 })) { mountVehicle(v); return; }
    }
  }
  function mountVehicle(v) {
    player.vehicle = { type: v.type, hp: v.hp, hpMax: v.hpMax };
    vehicleParked.splice(vehicleParked.indexOf(v), 1);
    player.w = v.w; player.h = v.h; player.prone = false;
    player.y = v.type === "flycar" ? v.y : GROUND_Y - v.h; player.x = v.x; player.vy = 0;
    player.invuln = Math.max(player.invuln, 24);
    SFX.power(); addShake(5); addPopup(player.x + 10, player.y - 8, v.type === "bike" ? "RIDE!" : "FLY!", "#ffd23f", true);
  }
  function dismountVehicle(destroyed) {
    const v = player.vehicle; if (!v) return;
    const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
    if (destroyed) { explodeAt(cx, cy, 52, 6); }
    else { const s = vehSize(v.type); vehicleParked.push({ type: v.type, x: player.x, y: v.type === "flycar" ? player.y : GROUND_Y - s.h, w: s.w, h: s.h, hp: v.hp, hpMax: v.hpMax }); }
    player.vehicle = null; player.w = 14; player.h = 30;
    if (player.y > GROUND_Y - 30) player.y = GROUND_Y - 30;
    player.vy = 0; player.invuln = Math.max(player.invuln, destroyed ? 90 : 22);
    SFX.jump();
  }
  function updateMounted(p) {
    const v = p.vehicle, ACC = 1.8, MAXV = v.type === "bike" ? 6.6 : 5.2;
    if (input.left) { p.vx -= ACC; if (!mouse.active) p.facing = -1; }
    if (input.right) { p.vx += ACC; if (!mouse.active) p.facing = 1; }
    if (!input.left && !input.right) p.vx *= 0.85;
    p.vx = Math.max(-MAXV, Math.min(MAXV, p.vx));
    if (v.type === "flycar") {
      if (input.jump) p.vy -= 0.65; if (input.down) p.vy += 0.6;
      if (!input.jump && !input.down) p.vy *= 0.86;
      p.vy = Math.max(-4.6, Math.min(4.6, p.vy));
      p.x += p.vx; p.y += p.vy; p.onGround = false;
      if (p.y < 16) { p.y = 16; p.vy = 0; }
      if (p.y > GROUND_Y - p.h) { p.y = GROUND_Y - p.h; p.vy = 0; }
    } else {
      if (input.jumpPressed && p.onGround) { p.vy = -10; p.onGround = false; SFX.jump(); }
      p.vy += GRAVITY; if (p.vy > 12) p.vy = 12;
      p.x += p.vx; p.y += p.vy; p.onGround = false;
      if (p.y + p.h >= GROUND_Y) { p.y = GROUND_Y - p.h; p.vy = 0; p.onGround = true; }
    }
    input.jumpPressed = false; input.dashPressed = false;
    if (p.x < 0) p.x = 0; if (p.x > levelW - p.w) p.x = levelW - p.w;
    if (Math.abs(p.vx) > 1.5) ramEnemies(p);
    if (Math.abs(p.vx) > 4 || Math.random() < 0.4) burst(p.x + (p.facing > 0 ? 0 : p.w), p.y + p.h - 3, "#ffb060", 1);
  }
  function ramEnemies(p) {
    for (const e of enemies) { if (!e.alive) continue; if (overlap(p, e)) { e.kbx = Math.sign(p.vx) * 8; e.vy = -3.2; e.flash = 6; hurtEnemy(e, 3); addShake(3); } }
    if (boss.alive && boss.active && overlap(p, boss)) hurtBoss(2);
  }
  function fireVehicle(p) {
    const sp = 8.2, f = p.facing, mx = p.x + (f > 0 ? p.w : 0);
    bullets.push({ kind: "bullet", x: mx, y: p.y + p.h * 0.35, vx: f * sp, vy: 0, r: 4, dmg: 4, spread: false, big: true });
    bullets.push({ kind: "bullet", x: mx, y: p.y + p.h * 0.62, vx: f * sp, vy: 0, r: 4, dmg: 4, spread: false, big: true });
    shootCD = 5; SFX.shoot();
  }
  // ---- air support ----
  function callAir() {
    if (gameState !== "playing" || airJet || player.airstrikes <= 0) return;
    player.airstrikes--;
    airJet = { x: camX - 70, y: 38, drop: 10, bombs: 8, dir: 1 };
    SFX.rocket(); addPopup(camX + VW / 2, 50, "AIR SUPPORT INBOUND!", "#9fd3ff", true);
  }
  function updateAir() {
    if (!airJet) return;
    airJet.x += 6.5;
    if (--airJet.drop <= 0 && airJet.bombs > 0 && airJet.x > camX + 20 && airJet.x < camX + VW - 20) {
      grenades.push({ x: airJet.x, y: airJet.y + 10, vx: 1.5, vy: 1, fuse: 200, gnd: true });
      airJet.bombs--; airJet.drop = 13;
    }
    if (airJet.x > camX + VW + 90) airJet = null;
  }
  // ---- shop between levels ----
  const SHOP = [
    { name: "+1 Max Health", cost: 80,  buy: () => { bonusHpMax++; player.hpMax++; player.hp = player.hpMax; } },
    { name: "Faster Fire",   cost: 120, buy: () => { fireRateMul = Math.max(0.45, fireRateMul - 0.12); } },
    { name: "Faster Dash",   cost: 100, buy: () => { dashCdBase = Math.max(14, dashCdBase - 6); } },
    { name: "+1 Life",       cost: 150, buy: () => { lives++; } }
  ];
  function canBuy(i) {
    if (SHOP[i].name === "Faster Fire" && fireRateMul <= 0.45) return false;
    if (SHOP[i].name === "Faster Dash" && dashCdBase <= 14) return false;
    return coinCount >= SHOP[i].cost;
  }
  function buyItem(i) {
    if (gameState !== "shop" || !SHOP[i]) return;
    if (!canBuy(i)) { SFX.hit(); return; }
    coinCount -= SHOP[i].cost; SHOP[i].buy(); SFX.power(); refreshShop();
  }
  function refreshShop() {
    const cs = document.getElementById("shop-coins"); if (cs) cs.textContent = coinCount;
    for (let i = 0; i < SHOP.length; i++) {
      const el = document.getElementById("shop-" + i); if (!el) continue;
      const maxed = (SHOP[i].name === "Faster Fire" && fireRateMul <= 0.45) || (SHOP[i].name === "Faster Dash" && dashCdBase <= 14);
      el.querySelector(".si-cost").textContent = maxed ? "MAX" : (SHOP[i].cost + "c");
      el.classList.toggle("afford", canBuy(i));
      el.classList.toggle("maxed", maxed);
    }
  }
  function openShop() {
    gameState = "shop"; refreshShop();
    document.getElementById("shop-screen").classList.remove("hidden");
  }
  function continueShop() {
    document.getElementById("shop-screen").classList.add("hidden");
    advanceLevel(); gameState = "playing";
  }
  function playerHit() {
    if (godMode || player.invuln > 0) return;
    if (player.vehicle) {   // vehicle soaks the hit
      player.vehicle.hp--; player.invuln = 26; addShake(6); SFX.hit();
      burst(player.x + player.w / 2, player.y + player.h / 2, "#ffd23f", 14);
      if (player.vehicle.hp <= 0) dismountVehicle(true);
      return;
    }
    player.hp--; flashT = 8; addShake(7); hitStop = Math.max(hitStop, 2); combo = 0; comboTimer = 0; SFX.hurt(); burst(player.x + 7, player.y + 15, "#ff5050", 20);
    if (berserk <= 0) rage = Math.min(100, rage + 14);   // taking damage builds rage
    if (player.hp <= 0) {
      lives--;
      if (lives <= 0) { gameState = "over"; saveHi(); SFX.over(); showOverlay("gameover-screen", "over-score", "SCORE " + score + "   BEST " + hiScore); }
      else { const w = player.weapon, owned = player.owned; player = makePlayer(); player.weapon = w; player.owned = owned; player.x = camX + 40; player.invuln = 150; }
    } else player.invuln = 70;
  }

  // ============================================================
  //  Update
  // ============================================================
  function update() {
    frame++;
    // shake/popups/blasts/freeze keep ticking even during hit-stop for snappy feel
    if (shake > 0) { shake *= 0.86; if (shake < 0.3) shake = 0; }
    for (let i = popups.length - 1; i >= 0; i--) { const q = popups[i]; q.y += q.vy; q.t--; if (q.t <= 0) popups.splice(i, 1); }
    for (let i = blasts.length - 1; i >= 0; i--) { const bl = blasts[i]; bl.r += (bl.max - bl.r) * 0.35; bl.t--; if (bl.t <= 0) blasts.splice(i, 1); }
    if (meleeFx && --meleeFx.t <= 0) meleeFx = null;
    if (portraitBlocked || gameState !== "playing") return;
    if (hitStop > 0) { hitStop--; return; }          // brief freeze-frame on big hits
    if (flashT > 0) flashT--;
    if (bannerT > 0) bannerT--;
    if (comboTimer > 0 && --comboTimer === 0) combo = 0;
    if (smashCD > 0) smashCD--;
    if (berserk > 0) { berserk--; if (berserk === 0) addPopup(player.x + 7, player.y - 6, "calm…", "#9fd3ff"); }
    const p = player;
    if (p.invuln > 0) p.invuln--;

    if (p.vehicle) { updateMounted(p); } else {
    const ACC = berserk > 0 ? 1.5 : 1.0, MAXV = berserk > 0 ? 4.8 : 3.6, FRICT = 0.78;
    p.prone = input.down && p.onGround && !(input.left || input.right) && berserk <= 0;
    if (input.left && p.dashTimer <= 0) { p.vx -= ACC; if (!mouse.active) p.facing = -1; }
    if (input.right && p.dashTimer <= 0) { p.vx += ACC; if (!mouse.active) p.facing = 1; }
    if (!input.left && !input.right && p.dashTimer <= 0) p.vx *= FRICT;
    if (p.dashTimer <= 0) p.vx = Math.max(-MAXV, Math.min(MAXV, p.vx));
    // jump + double jump
    if (input.jumpPressed) {
      if (p.onGround) { p.vy = -9.6; p.onGround = false; p.jumps = 1; SFX.jump(); }
      else if (p.jumps > 0) { p.vy = -8.8; p.jumps--; SFX.jump(); burst(p.x + 7, p.y + p.h, "#bfe6ff", 8); }
    }
    input.jumpPressed = false;
    // dash (Shift / DASH): quick burst with brief i-frames
    if (p.dashCD > 0) p.dashCD--;
    if (input.dashPressed && p.dashCD <= 0) {
      p.dashTimer = 9; p.dashCD = dashCdBase; p.vx = p.facing * 9.5; p.vy *= 0.3;
      p.invuln = Math.max(p.invuln, 11); SFX.jump(); addShake(3);
    }
    input.dashPressed = false;
    if (p.dashTimer > 0) { p.dashTimer--; burst(p.x + 7, p.y + 16, "#9fd3ff", 2); }
    p.vy += GRAVITY; if (p.vy > 12) p.vy = 12;
    p.x += p.vx; if (p.x < 0) p.x = 0; if (p.x > levelW - p.w) p.x = levelW - p.w;
    p.h = p.prone ? 18 : 30;
    p.y += p.vy; p.onGround = false;
    if (p.y + p.h >= GROUND_Y) { p.y = GROUND_Y - p.h; p.vy = 0; p.onGround = true; }
    for (const pl of platforms) {
      const wasAbove = p.y + p.h - p.vy <= pl.y + 2;
      if (p.vy >= 0 && wasAbove && p.x + p.w > pl.x && p.x < pl.x + pl.w && p.y + p.h >= pl.y && p.y + p.h <= pl.y + pl.h + 12) { p.y = pl.y - p.h; p.vy = 0; p.onGround = true; }
    }
    if (p.onGround) p.jumps = 2;
    }
    if (shootCD > 0) shootCD--;
    if (input.fire && shootCD <= 0) { if (p.vehicle) fireVehicle(p); else firePlayer(); }
    if (meleeCD > 0) meleeCD--;
    if (input.melee && meleeCD <= 0 && !p.vehicle) doMelee();
    if (grenadeCD > 0) grenadeCD--;
    updateAir();

    const target = p.x - VW * 0.38;
    camX += (target - camX) * 0.12;
    if (camX < 0) camX = 0; if (camX > levelW - VW) camX = levelW - VW;

    // arena wave fights: lock the screen and clear a wave to proceed
    if (!arenaActive) {
      for (const a of arenas) { if (!a.done && !a.triggered && p.x > a.x && p.x < a.x + 120) { triggerArena(a); break; } }
    }
    if (arenaActive) {
      camX = arenaLeft;
      if (p.x < arenaLeft + 6) p.x = arenaLeft + 6;
      if (p.x > arenaLeft + VW - p.w - 6) p.x = arenaLeft + VW - p.w - 6;
      arenaTimer++;
      let alive = 0; for (const e of enemies) if (e.arena && e.alive) alive++;
      if (alive === 0 || arenaTimer > 3600) {
        arenaActive = false; if (curArena) curArena.done = true;
        for (const e of enemies) if (e.arena) e.arena = false;
        addPopup(arenaLeft + VW / 2, 60, "AREA CLEAR!", "#5fe07a", true); SFX.fanfare(); addShake(5);
      }
    }

    // player projectiles
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; b.x += b.vx; b.y += b.vy;
      if (b.kind === "flame") { b.life--; b.r += 0.22; b.vy += 0.03; if (b.life <= 0) { bullets.splice(i, 1); continue; } }
      if (b.x < camX - 30 || b.x > camX + VW + 30 || b.y < -30 || b.y > VH + 30) { bullets.splice(i, 1); continue; }
      let hit = false; const bb = rect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      for (const e of enemies) {
        if (!e.alive) continue;
        if (overlap(bb, e)) { if (b.kind === "rocket") explodeAt(b.x, b.y, 72, b.dmg); else hurtEnemy(e, b.dmg); hit = true; break; }
      }
      if (!hit && boss.alive && boss.active && overlap(bb, boss)) { if (b.kind === "rocket") explodeAt(b.x, b.y, 72, b.dmg); else hurtBoss(b.dmg); hit = true; }
      if (hit) bullets.splice(i, 1);
    }
    // deferred: open shop after a boss is cleared (avoids mid-loop array swap)
    if (pendingShop) { pendingShop = false; openShop(); return; }

    // enemies
    for (const e of enemies) {
      if (!e.alive) continue;
      if (!e.active && e.x < camX + VW + 60 && e.x > camX - 80) e.active = true;
      if (!e.active) continue;
      if (e.flash > 0) e.flash--;
      if (e.kbx) { e.x += e.kbx; e.kbx *= 0.8; if (Math.abs(e.kbx) < 0.4) e.kbx = 0; }
      if (e.type === "soldier") {
        e.x += (p.x > e.x ? 1 : -1) * 0.7; e.vy += GRAVITY; e.y += e.vy; if (e.y + e.h >= GROUND_Y) { e.y = GROUND_Y - e.h; e.vy = 0; }
        if (--e.fireCD <= 0 && Math.abs(e.x - p.x) < 230) { enemyShoot(e.x + 7, e.y + 8, p.x + 7, p.y + 12, 2.6); e.fireCD = (110 + Math.random() * 60) * fireMul; }
      } else if (e.type === "heavy") {
        e.x += (p.x > e.x ? 1 : -1) * 0.45; e.vy += GRAVITY; e.y += e.vy; if (e.y + e.h >= GROUND_Y) { e.y = GROUND_Y - e.h; e.vy = 0; }
        if (--e.fireCD <= 0 && Math.abs(e.x - p.x) < 250) { enemyShoot(e.x + 9, e.y + 10, p.x + 7, p.y + 12, 2.5); enemyShoot(e.x + 9, e.y + 14, p.x + 7, p.y + 16, 2.5); e.fireCD = (75 + Math.random() * 35) * fireMul; }
      } else if (e.type === "jumper") {
        e.x += (p.x > e.x ? 1 : -1) * 0.9; e.vy += GRAVITY; e.y += e.vy;
        let onG = false; if (e.y + e.h >= GROUND_Y) { e.y = GROUND_Y - e.h; e.vy = 0; onG = true; }
        if (onG) { if (--e.jumpCD <= 0) { e.vy = -8.2; e.jumpCD = 55 + Math.random() * 45; } }
      } else if (e.type === "turret") {
        if (--e.fireCD <= 0 && Math.abs(e.x - p.x) < 250) { enemyShoot(e.x + 9, e.y + 6, p.x + 7, p.y + 12, 2.3); e.fireCD = 95 * fireMul; }
      } else if (e.type === "drone") {
        e.t += 0.05; e.y = e.baseY + Math.sin(e.t) * 16; e.x += (p.x > e.x ? 1 : -1) * 0.5;
        if (--e.fireCD <= 0 && Math.abs(e.x - p.x) < 260) { enemyShoot(e.x + 11, e.y + 12, p.x + 7, p.y + 12, 2.8); e.fireCD = 90 * fireMul; }
      } else if (e.type === "charger") {
        e.vy += GRAVITY; e.y += e.vy; if (e.y + e.h >= GROUND_Y) { e.y = GROUND_Y - e.h; e.vy = 0; }
        e.chargeT++; const dir = p.x > e.x ? 1 : -1;
        e.x += dir * ((e.chargeT % 90 < 50) ? 0.7 : 2.7);   // bursts of fast charging
      }
      if (overlap(p, e)) {
        if (berserk > 0) { e.kbx = (e.x < p.x ? -1 : 1) * 7; e.vy = -3; e.flash = 6; hurtEnemy(e, 2); }
        else playerHit();
      }
    }

    if (boss.alive) {
      if (!boss.active && camX > levelW - VW - 30) boss.active = true;
      if (boss.active) {
        boss.coreT += 0.06; if (boss.pulse > 0) boss.pulse--;
        const frac = boss.hp / boss.hpMax, ph = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
        if (ph !== boss.phase) {                       // phase transition
          boss.phase = ph; boss.pulse = 20; boss.fireCD = 28; addShake(11); hitStop = Math.max(hitStop, 3);
          for (let k = 0; k < ph; k++) { const e = makeSoldier(boss.x - 24 - k * 22); e.active = true; e.arena = false; enemies.push(e); }
          if (ph > 1) addPopup(boss.x + boss.w / 2, boss.y - 6, "PHASE " + ph + "!", "#ff5a3c", true);
        }
        // stalk the player within the final screen
        const tx = p.x + (p.x < boss.x ? 46 : -46);
        boss.x += Math.sign(tx - boss.x) * (0.3 + boss.phase * 0.25);
        boss.x = Math.max(levelW - VW + 16, Math.min(levelW - boss.w - 6, boss.x));
        boss.y = GROUND_Y - boss.h + Math.sin(boss.coreT * 1.6) * 4;
        if (--boss.fireCD <= 0) {
          const cx = boss.x + boss.w / 2, cy = boss.y + boss.h / 2, base = Math.atan2((p.y + 12) - cy, p.x - cx);
          if (boss.phase === 1) { for (let a = -1; a <= 1; a++) eBullets.push(bShot(cx, cy, base + a * 0.22, 3)); boss.fireCD = 50; }
          else if (boss.phase === 2) { for (let a = -2; a <= 2; a++) eBullets.push(bShot(cx, cy, base + a * 0.2, 3.2)); boss.fireCD = 40; }
          else { for (let a = -1; a <= 1; a++) eBullets.push(bShot(cx, cy, base + a * 0.16, 3.9)); boss.fireCD = 22; }
        }
        if (overlap(p, boss)) playerHit();
      }
    }

    for (let i = eBullets.length - 1; i >= 0; i--) {
      const b = eBullets[i]; b.x += b.vx; b.y += b.vy;
      if (b.x < camX - 30 || b.x > camX + VW + 30 || b.y < -30 || b.y > VH + 30) { eBullets.splice(i, 1); continue; }
      if (overlap(rect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2), p)) { eBullets.splice(i, 1); playerHit(); }
    }
    for (const c of coins) { if (c.taken) continue; c.t += 0.15; if (overlap(p, { x: c.x - 6, y: c.y - 6, w: 12, h: 12 })) { c.taken = true; coinCount++; score += 25; SFX.coin(); burst(c.x, c.y, "#ffd23f", 6); } }
    for (const pk of pickups) {
      if (pk.taken) continue; pk.t += 0.1;
      if (overlap(p, pk)) {
        pk.taken = true;
        const wname = PICKUP_WEAPON[pk.kind] || "spread";
        if (!player.owned.includes(wname)) player.owned.push(wname);
        player.weapon = wname; score += 50; SFX.power(); burst(pk.x + 8, pk.y + 8, "#3fd0ff", 18);
      }
    }
    for (let i = grenades.length - 1; i >= 0; i--) {
      const g = grenades[i]; g.vy += GRAVITY * (g.gnd ? 0.5 : 0.85); g.x += g.vx; g.y += g.vy; g.fuse--;
      let boom = g.fuse <= 0;
      if (g.y + 4 >= GROUND_Y) { if (g.gnd) boom = true; else { g.y = GROUND_Y - 4; g.vy *= -0.42; g.vx *= 0.6; } }
      if (!boom) for (const e of enemies) { if (e.alive && overlap({ x: g.x - 4, y: g.y - 4, w: 8, h: 8 }, e)) { boom = true; break; } }
      if (!boom && boss.alive && boss.active && overlap({ x: g.x - 4, y: g.y - 4, w: 8, h: 8 }, boss)) boom = true;
      if (boom) { explodeAt(g.x, g.y, 66, 12); grenades.splice(i, 1); }
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.t += 0.15; d.vy += GRAVITY * 0.6; d.y += d.vy;
      if (d.y > GROUND_Y - 6) { d.y = GROUND_Y - 6; d.vy = 0; }
      if (overlap(p, { x: d.x - 8, y: d.y - 8, w: 16, h: 16 })) {
        drops.splice(i, 1);
        if (player.hp < player.hpMax) player.hp++;
        score += 30; SFX.coin(); addPopup(d.x, d.y - 6, "+HP", "#ff6b8a");
        burst(d.x, d.y, "#ff6b8a", 10);
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) { const pt = particles[i]; pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.15; pt.life--; if (pt.life <= 0) particles.splice(i, 1); }
    if (p.y > VH + 40) playerHit();
  }

  // ============================================================
  //  Rendering
  // ============================================================
  function draw() {
    ctx.setTransform(RS, 0, 0, RS, 0, 0);   // 1.5x supersample base transform (logical coords unchanged)
    drawBackdrop();
    const sx = shake ? (Math.random() * 2 - 1) * shake : 0, sy = shake ? (Math.random() * 2 - 1) * shake : 0;
    ctx.save(); ctx.translate(-Math.round(camX) + Math.round(sx), Math.round(sy));
    if (arenaActive) drawArenaWalls();
    drawGround(); platforms.forEach(drawPlatform); coins.forEach(drawCoin); pickups.forEach(drawPickup); drops.forEach(drawDrop);
    vehicleParked.forEach((v) => drawVehicleAt(v.type, v.x, v.y, v.w, v.h, 1, v.hp, v.hpMax, false));
    drawAirJet();
    enemies.forEach((e) => e.alive && drawEnemy(e));
    if (boss.alive) drawBoss();
    drawBullets();
    ctx.fillStyle = "#ff5a5a"; for (const b of eBullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); }
    grenades.forEach(drawGrenade);
    drawPlayer();
    if (meleeFx) drawMeleeFx();
    for (const pt of particles) { ctx.globalAlpha = Math.max(0, pt.life / 24); ctx.fillStyle = pt.color; ctx.fillRect(pt.x - 1, pt.y - 1, 3, 3); }
    ctx.globalAlpha = 1;
    drawBlasts();
    drawPopups();
    ctx.restore();
    drawHUD();
    if (flashT > 0) { ctx.fillStyle = "rgba(255,40,40," + (flashT / 18) + ")"; ctx.fillRect(0, 0, VW, VH); }
    if (bannerT > 0 && gameState === "playing") drawBanner();
    if (gameState === "paused") drawPaused();
  }

  function drawBullets() {
    for (const b of bullets) {
      if (b.kind === "flame") {
        ctx.globalAlpha = Math.max(0, b.life / 18);
        ctx.fillStyle = b.life > 10 ? "#fff3a0" : (b.life > 5 ? "#ff9f1c" : "#e7402c");
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      } else if (b.kind === "rocket") {
        ctx.fillStyle = "#ffb13f"; ctx.beginPath(); ctx.arc(b.x - b.vx * 0.6, b.y - b.vy * 0.6, 3, 0, 7); ctx.fill();
        ctx.fillStyle = "#cfd6e0"; ctx.fillRect(b.x - 4, b.y - 2, 8, 4);
        ctx.fillStyle = "#e74c3c"; ctx.fillRect(b.x + (b.vx >= 0 ? 3 : -5), b.y - 1, 2, 2);
      } else {
        ctx.fillStyle = b.spread ? "#ff9f1c" : "#fff36b"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 1, 0, 7); ctx.fill();
      }
    }
  }

  function drawBackdrop() {
    if (level === 2) drawWaterfallScene();
    else if (level === 3) drawCyberScene();
    else drawDesertScene();
  }
  function skyGrad(c0, c1, c2) {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
  function drawStars(maxY, n) {
    for (let i = 0; i < n; i++) {
      const s = STARS[i], tw = 0.5 + 0.5 * Math.sin(frame * 0.05 + s.p);
      if (s.y > maxY) continue;
      ctx.globalAlpha = 0.3 + tw * 0.7; ctx.fillStyle = "#fff";
      ctx.fillRect((s.x - camX * 0.05) % VW, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }
  function mesa(x, baseY, w, h) {
    ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x + 3, baseY - h);
    ctx.lineTo(x + w - 3, baseY - h); ctx.lineTo(x + w, baseY); ctx.closePath(); ctx.fill();
  }
  function drawDesertScene() {
    skyGrad("#1a1c47", "#7a3f6e", "#e8895f");
    drawStars(150, 40);
    // glowing sun near horizon
    const sx = 240 - camX * 0.04, sy = 150, pr = 30 + Math.sin(frame * 0.04) * 2;
    let rg = ctx.createRadialGradient(sx, sy, 4, sx, sy, pr + 30);
    rg.addColorStop(0, "#fff6d8"); rg.addColorStop(0.4, "#ffd07a"); rg.addColorStop(1, "rgba(255,120,90,0)");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(sx, sy, pr + 30, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff3d0"; ctx.beginPath(); ctx.arc(sx, sy, pr, 0, 7); ctx.fill();
    // mesas (parallax)
    ctx.fillStyle = "#7a3b34"; let o = (camX * 0.25) % 360;
    for (let i = -1; i < 3; i++) { mesa(i * 360 - o + 40, 175, 70, 70); mesa(i * 360 - o + 250, 175, 50, 45); }
    ctx.fillStyle = "#5a2a26"; o = (camX * 0.45) % 300;
    for (let i = -1; i < 4; i++) mesa(i * 300 - o + 120, 180, 90, 40);
  }
  function drawWaterfallScene() {
    skyGrad("#274a6e", "#3f7fa0", "#9fd0c0");
    // cliffs framing a gap
    ctx.fillStyle = "#26432f"; let o = (camX * 0.3) % 420;
    for (let i = -1; i < 3; i++) {
      const bx = i * 420 - o;
      ctx.fillRect(bx, 0, 90, VH); ctx.fillRect(bx + 300, 0, 120, VH);
      ctx.fillStyle = "#34553c"; ctx.fillRect(bx + 70, 0, 24, VH); ctx.fillStyle = "#26432f";
    }
    // flowing waterfall in the gap (animated)
    const wx = 150 - (camX * 0.3) % 420 + 420, ww = 150;
    drawWaterfall(wx, ww);
    drawWaterfall(wx - 420, ww); drawWaterfall(wx + 420, ww);
  }
  function drawWaterfall(wx, ww) {
    ctx.fillStyle = "#bfe6f5"; ctx.fillRect(wx, 0, ww, 200);
    // falling streaks scroll downward
    for (let i = 0; i < 22; i++) {
      const sx = wx + 6 + (i * 6.7) % ww;
      const off = (frame * 6 + i * 53) % 60;
      ctx.fillStyle = i % 3 ? "#ffffff" : "#dff3ff";
      ctx.globalAlpha = 0.8; ctx.fillRect(sx, off - 60 + ((i * 37) % 200), 2, 22); ctx.globalAlpha = 1;
    }
    // misty pool glow at base
    ctx.fillStyle = "rgba(220,245,255," + (0.3 + 0.15 * Math.sin(frame * 0.1)) + ")";
    ctx.fillRect(wx - 6, 188, ww + 12, 18);
  }
  function drawCyberScene() {
    skyGrad("#241043", "#7a2f6e", "#e06a3c");
    drawStars(140, 40);
    // moon
    const mx = 360 - camX * 0.03; ctx.fillStyle = "#ffe6c0"; ctx.beginPath(); ctx.arc(mx, 70, 24, 0, 7); ctx.fill();
    ctx.fillStyle = "#e8c89a"; ctx.beginPath(); ctx.arc(mx + 8, 64, 5, 0, 7); ctx.arc(mx - 6, 78, 4, 0, 7); ctx.fill();
    // drifting airship
    const ax = (frame * 0.3) % (VW + 120) - 60;
    ctx.fillStyle = "#2a2f44"; ctx.beginPath(); ctx.ellipse(ax, 50, 22, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffcf6a"; ctx.fillRect(ax - 14, 50, 2, 2); ctx.fillRect(ax + 10, 49, 2, 2);
    // neon city skyline (parallax, flickering windows)
    drawSkyline((camX * 0.25), "#1a1430", 150, 46);
    drawSkyline((camX * 0.5), "#120e22", 168, 70);
  }
  function drawSkyline(off, col, baseY, maxH) {
    off = off % 80; ctx.fillStyle = col;
    for (let i = -1; i < 9; i++) {
      const bx = i * 80 - off + ((i * 53) % 30), bw = 34 + (i * 17) % 26, bh = maxH - (i * 29) % 40;
      ctx.fillStyle = col; ctx.fillRect(bx, baseY - bh, bw, bh + (VH - baseY));
      // neon windows
      for (let wy = baseY - bh + 6; wy < VH; wy += 10)
        for (let wx2 = bx + 4; wx2 < bx + bw - 3; wx2 += 8) {
          if ((((wx2 * 13 + wy * 7 + (i * 31)) % 5) === 0) ^ (Math.floor(frame / 30 + wx2) % 7 === 0)) { ctx.fillStyle = (wx2 + wy) % 3 ? "#ff5aa0" : "#5af0ff"; ctx.fillRect(wx2, wy, 2, 3); ctx.fillStyle = col; }
        }
    }
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, theme.skyTop); g.addColorStop(0.55, theme.skyMid); g.addColorStop(1, theme.skyBot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = theme.sun; ctx.beginPath(); ctx.arc(60, 46, 22, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(60, 46, 32, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    const co = (camX * 0.1) % 260;
    for (let i = -1; i < 4; i++) cloud(i * 260 + 120 - co, 50 + (i % 2) * 18);
  }
  function cloud(x, y) { ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.arc(x + 14, y + 2, 16, 0, 7); ctx.arc(x + 32, y, 12, 0, 7); ctx.fill(); }
  function drawHills() {
    let off = (camX * 0.2) % 300; ctx.fillStyle = theme.hillFar;
    for (let i = -1; i < 4; i++) hill(i * 300 - off, 200, 150, 90);
    off = (camX * 0.38) % 260; ctx.fillStyle = theme.hillNear;
    for (let i = -1; i < 5; i++) hill(i * 260 - off, 210, 140, 70);
  }
  function hill(x, baseY, w, h) { ctx.beginPath(); ctx.moveTo(x, baseY); ctx.quadraticCurveTo(x + w / 2, baseY - h, x + w, baseY); ctx.lineTo(x + w, VH); ctx.lineTo(x, VH); ctx.closePath(); ctx.fill(); }
  function drawVillage() {
    const off = (camX * 0.6) % 300;
    for (let i = -1; i < 4; i++) {
      const bx = i * 300 - off;
      tree(bx + 30, 196); house(bx + 90, 150, theme.roof1, theme.wall1); tree(bx + 200, 192); house(bx + 240, 158, theme.roof2, theme.wall2);
    }
  }
  function tree(x, gy) {
    ctx.fillStyle = theme.trunk; ctx.fillRect(x - 4, gy - 30, 8, 34);
    ctx.fillStyle = theme.leaf1; ctx.beginPath(); ctx.arc(x, gy - 40, 22, 0, 7); ctx.fill();
    ctx.fillStyle = theme.leaf2; ctx.beginPath(); ctx.arc(x - 8, gy - 36, 14, 0, 7); ctx.arc(x + 10, gy - 38, 16, 0, 7); ctx.fill();
  }
  function house(x, roofY, roof, wall) {
    const w = 64, h = 46;
    ctx.fillStyle = wall; ctx.fillRect(x, roofY + 14, w, h);
    ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - 6, roofY + 16); ctx.lineTo(x + w / 2, roofY - 6); ctx.lineTo(x + w + 6, roofY + 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x + w / 2 - 7, roofY + 34, 14, 26);
    ctx.fillStyle = "#8fd0ef"; ctx.fillRect(x + 8, roofY + 24, 12, 12); ctx.fillRect(x + w - 20, roofY + 24, 12, 12);
    ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 1; ctx.strokeRect(x + 8, roofY + 24, 12, 12); ctx.strokeRect(x + w - 20, roofY + 24, 12, 12);
  }
  function drawGround() {
    const x0 = camX - 10, w = VW + 20;
    ctx.fillStyle = theme.ground; ctx.fillRect(x0, GROUND_Y + 6, w, VH - GROUND_Y);
    ctx.fillStyle = theme.grass; ctx.fillRect(x0, GROUND_Y, w, 8);
    ctx.fillStyle = theme.cobble;
    for (let x = Math.floor(x0 / 16) * 16; x < x0 + w; x += 16)
      for (let y = GROUND_Y + 14; y < VH; y += 12) ctx.fillRect(x + ((y / 12) % 2) * 8, y, 12, 8);
  }
  function drawPlatform(pl) {
    ctx.fillStyle = theme.ground; ctx.fillRect(pl.x, pl.y + 4, pl.w, pl.h);
    ctx.fillStyle = theme.grass; ctx.fillRect(pl.x, pl.y, pl.w, 5);
  }
  function drawCoin(c) {
    if (c.taken) return;
    if (drawSprite("coin", frame / 4 + (c.x | 0), c.x - 9, c.y - 9, 18, 18, false)) return;
    drawCoinShapes(c);
  }
  function drawCoinShapes(c) {
    const sw = Math.abs(Math.cos(c.t)) * 7 + 1;
    ctx.fillStyle = "#caa31a"; ctx.beginPath(); ctx.ellipse(c.x, c.y, sw + 1, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.ellipse(c.x, c.y, sw, 7, 0, 0, 7); ctx.fill();
    if (sw > 4) { ctx.fillStyle = "#fff0a8"; ctx.fillRect(c.x - 1, c.y - 4, 2, 8); }
  }
  function drawPickup(pk) {
    if (pk.taken) return;
    const y = pk.y + Math.sin(pk.t) * 3;
    const col = pk.kind === "F" ? "#ff7a1c" : pk.kind === "R" ? "#5b8c5a" : "#e7402c";
    ctx.fillStyle = "#101820"; ctx.fillRect(pk.x - 1, y - 1, 18, 18);
    ctx.fillStyle = col; ctx.fillRect(pk.x, y, 16, 16);
    ctx.fillStyle = "#ffd23f"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(pk.kind, pk.x + 8, y + 9);
  }

  function drawVehicleDecor(type, x, y, w, h, f, hp, hpMax, mounted) {
    if (mounted) {   // rider tucked onto the seat
      ctx.fillStyle = "#2e7d4f"; ctx.fillRect(x + w / 2 - 3, y - 4, 7, 8);
      ctx.fillStyle = "#f0c090"; ctx.fillRect(x + w / 2 - 2, y - 9, 5, 5);
      ctx.fillStyle = "#c0392b"; ctx.fillRect(x + w / 2 - 3, y - 10, 7, 2);
    } else if (Math.abs((player.x + player.w / 2) - (x + w / 2)) < 60) {
      ctx.fillStyle = "#ffd23f"; ctx.font = "bold 9px Trebuchet MS, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(Math.floor(frame / 20) % 2 ? "RIDE (F)" : "▲ RIDE", x + w / 2, y - 14); ctx.textAlign = "left";
    }
    if (hpMax) { ctx.fillStyle = "#5fe07a"; for (let i = 0; i < hp; i++) ctx.fillRect(x + 2 + i * 4, y - (mounted ? 14 : 2), 3, 2); }
  }
  function drawVehicleAt(type, x, y, w, h, f, hp, hpMax, mounted) {
    x = Math.round(x); y = Math.round(y);
    const key = type === "flycar" ? "flycar" : "bike";
    if (IMG[key] && IMG[key]._ok) {
      if (type === "flycar") drawWhole(key, x + w / 2, y + h / 2, h * 1.85, f < 0, "center");
      else drawWhole(key, x + w / 2, y + h + 3, h * 1.7, f < 0, "bottom");
      drawVehicleDecor(type, x, y, w, h, f, hp, hpMax, mounted);
      return;
    }
    if (type === "bike") {
      // wheels
      ctx.fillStyle = "#15171c"; ctx.beginPath(); ctx.arc(x + 9, y + h - 4, 6, 0, 7); ctx.arc(x + w - 9, y + h - 4, 6, 0, 7); ctx.fill();
      ctx.fillStyle = "#2a2f3a"; ctx.beginPath(); ctx.arc(x + 9, y + h - 4, 2.5, 0, 7); ctx.arc(x + w - 9, y + h - 4, 2.5, 0, 7); ctx.fill();
      // sleek red body
      ctx.fillStyle = "#d8202a"; ctx.beginPath();
      ctx.moveTo(x + 2, y + h - 8); ctx.lineTo(x + w - 4, y + h - 10); ctx.lineTo(x + w, y + 6); ctx.lineTo(x + w - 16, y + 4); ctx.lineTo(x + 8, y + 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ff5a4a"; ctx.fillRect(x + 12, y + 6, w - 22, 3);
      ctx.fillStyle = "#7a0f15"; ctx.fillRect(x + 4, y + h - 9, w - 8, 3);
      // neon underglow + headlight
      ctx.fillStyle = "rgba(80,200,255,0.5)"; ctx.fillRect(x + 6, y + h - 2, w - 12, 2);
      ctx.fillStyle = "#bfe9ff"; ctx.fillRect(f > 0 ? x + w - 3 : x, y + 7, 3, 3);
      // forward cannon
      ctx.fillStyle = "#cfd6e0"; ctx.fillRect(f > 0 ? x + w - 2 : x - 8, y + 9, 10, 3);
    } else { // flycar
      ctx.fillStyle = "#2b3550"; ctx.beginPath();
      ctx.moveTo(x, y + h - 6); ctx.lineTo(x + w, y + h - 8); ctx.lineTo(x + w - 6, y + 4); ctx.lineTo(x + 10, y + 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#3f5a8c"; ctx.fillRect(x + 6, y + 5, w - 16, 6);
      ctx.fillStyle = "#9fe0ff"; ctx.fillRect(x + 12, y + 2, 16, 6);             // canopy
      ctx.fillStyle = "#11151f"; ctx.fillRect(x + 2, y + h - 6, w - 4, 4);
      // side guns
      ctx.fillStyle = "#cfd6e0"; ctx.fillRect(f > 0 ? x + w - 2 : x - 8, y + 9, 10, 3);
      // thruster flames
      const fl = (frame % 4 < 2) ? 7 : 4;
      ctx.fillStyle = "#ffb13f"; ctx.fillRect(f > 0 ? x - fl : x + w, y + h - 7, fl, 4);
      ctx.fillStyle = "#fff1b0"; ctx.fillRect(f > 0 ? x - fl / 2 : x + w, y + h - 6, fl / 2, 2);
    }
    if (mounted) {   // rider
      ctx.fillStyle = "#2e7d4f"; ctx.fillRect(x + w / 2 - 3, y - 6, 7, 8);
      ctx.fillStyle = "#f0c090"; ctx.fillRect(x + w / 2 - 2, y - 11, 5, 5);
      ctx.fillStyle = "#c0392b"; ctx.fillRect(x + w / 2 - 3, y - 12, 7, 2);
    } else {         // parked: "RIDE (F)" prompt when player is near
      if (Math.abs((player.x + player.w / 2) - (x + w / 2)) < 60) {
        ctx.fillStyle = "#ffd23f"; ctx.font = "bold 9px Trebuchet MS, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(Math.floor(frame / 20) % 2 ? "RIDE (F)" : "▲ RIDE", x + w / 2, y - 16); ctx.textAlign = "left";
      }
    }
    // hp pips
    if (hpMax) { ctx.fillStyle = "#5fe07a"; for (let i = 0; i < hp; i++) ctx.fillRect(x + 2 + i * 4, y - (mounted ? 16 : 4), 3, 2); }
  }
  function drawAirJet() {
    if (!airJet) return;
    const x = Math.round(airJet.x), y = airJet.y;
    ctx.fillStyle = "#4a5568"; ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x + 30, y); ctx.lineTo(x + 30, y + 8); ctx.lineTo(x, y + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#6b7688"; ctx.fillRect(x + 6, y - 3, 12, 4);            // tail fin
    ctx.fillStyle = "#9fe0ff"; ctx.fillRect(x + 24, y + 2, 4, 3);           // cockpit
    ctx.fillStyle = "#ffb13f"; ctx.fillRect(x - 5, y + 4, 5, 3);            // exhaust
  }
  function drawPlayer() {
    const p = player;
    if (p.invuln > 0 && Math.floor(frame / 4) % 2 === 0) return;
    if (p.vehicle) { drawVehicleAt(p.vehicle.type, p.x, p.y, p.w, p.h, p.facing, p.vehicle.hp, p.vehicle.hpMax, true); return; }
    let key, spd = 6;
    if (p.prone) key = "player_idle";
    else if (!p.onGround) key = p.vy < 0 ? "player_jump" : "player_fall";
    else if (Math.abs(p.vx) > 0.4) { key = "player_run"; spd = 3; }
    else key = "player_idle";
    const big = berserk > 0;
    if (big) {   // green rage aura
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2, ar = 26 + Math.sin(frame * 0.3) * 3;
      const ag = ctx.createRadialGradient(cx, cy, 4, cx, cy, ar);
      ag.addColorStop(0, "rgba(124,252,0,0.35)"); ag.addColorStop(1, "rgba(124,252,0,0)");
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cx, cy, ar, 0, 7); ctx.fill();
    }
    const dw = big ? 50 : 38, dh = big ? 50 : 38;
    const dx = p.x + p.w / 2 - dw / 2;
    const dy = p.y + p.h - dh + 5 + (p.prone ? 9 : 0);
    if (big) ctx.filter = "hue-rotate(75deg) saturate(1.6) brightness(1.1)";
    const drew = drawSprite(key, frame / spd, dx, dy, dw, dh, p.facing < 0);
    if (big) ctx.filter = "none";
    if (drew) {
      drawFace(dx + dw / 2, dy + dh * 0.30, dw * 0.20);
      if (!big) drawGunOverlay();
      return;
    }
    drawPlayerShapes();
    drawFace(p.x + p.w / 2, p.y + (big ? 2 : 4), big ? 10 : 7);
  }
  // optional: paste the player's own photo (assets/player_face.png) onto the head, circle-cropped
  function drawFace(cx, cy, r) {
    const im = IMG.player_face;
    if (!im || !im._ok || !im.naturalWidth) return;
    const bob = Math.sin(frame * 0.18) * 0.6;   // tiny life so it doesn't feel pasted-on
    cy += bob;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.closePath(); ctx.clip();
    const iw = im.naturalWidth, ih = im.naturalHeight, s = Math.max((2 * r) / iw, (2 * r) / ih);
    const w = iw * s, h = ih * s;
    if (berserk > 0) ctx.filter = "hue-rotate(75deg) saturate(1.6) brightness(1.1)";
    ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
    ctx.filter = "none";
    ctx.restore();
    ctx.lineWidth = 1.5; ctx.strokeStyle = berserk > 0 ? "#7CFC00" : "rgba(20,24,32,0.55)";
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  }

  // small code-drawn gun barrel + muzzle so aim/shooting reads on the sprite
  function drawGunOverlay() {
    const p = player, x = Math.round(p.x), y = Math.round(p.y), f = p.facing;
    ctx.fillStyle = "#2b2f38";
    let gx, gy, gw = 12, gh = 3;
    if (input.up && !input.left && !input.right) { gx = x + p.w / 2 - 1; gy = y - 4; gw = 3; gh = 11; }
    else if (input.up) { gx = f > 0 ? x + 9 : x - 5; gy = y + 2; }
    else if (input.down && !p.onGround) { gx = f > 0 ? x + 9 : x - 5; gy = y + 18; }
    else { gx = f > 0 ? x + 9 : x - 7; gy = y + 14; }
    ctx.fillRect(gx, gy, gw, gh);
    if (shootCD > (WEAPONS[p.weapon].cd - 3)) { ctx.fillStyle = "#ffe070"; ctx.fillRect(f > 0 ? gx + gw : gx - 3, gy - 1, 3, gh + 2); }
  }

  function drawPlayerShapes() {
    const p = player;
    const x = Math.round(p.x), y = Math.round(p.y), f = p.facing;
    const skin = "#f0c090";
    const suit = p.weapon === "spread" ? "#e85d4e" : p.weapon === "flame" ? "#e08a2a" : p.weapon === "rocket" ? "#6a7a3a" : "#2e7d4f";
    const suitD = p.weapon === "spread" ? "#b8412f" : p.weapon === "flame" ? "#b5651a" : p.weapon === "rocket" ? "#4a5a26" : "#1f5c39";
    const boot = "#26324a";
    if (p.prone) {
      ctx.fillStyle = suit; ctx.fillRect(x - 2, y + 6, 20, 8);
      ctx.fillStyle = skin; ctx.fillRect(x + (f > 0 ? 16 : -4), y + 6, 4, 4);
      ctx.fillStyle = "#cfd6e0"; ctx.fillRect(x + (f > 0 ? 18 : -8), y + 8, 8, 2); return;
    }
    const stepping = Math.abs(p.vx) > 0.3 && p.onGround, sw = stepping ? (Math.floor(frame / 5) % 2 === 0 ? 3 : -3) : 0;
    ctx.fillStyle = boot; ctx.fillRect(x + 2 - sw, y + 20, 4, 10); ctx.fillRect(x + 8 + sw, y + 20, 4, 10);
    ctx.fillStyle = suitD; ctx.fillRect(x + 2, y + 14, 10, 7);
    ctx.fillStyle = suit; ctx.fillRect(x + 2, y + 8, 10, 8);
    ctx.fillStyle = skin; ctx.fillRect(x + 4, y + 1, 7, 7);
    ctx.fillStyle = "#1a1a1a"; ctx.fillRect(x + (f > 0 ? 8 : 4), y + 3, 2, 2);
    ctx.fillStyle = "#c0392b"; ctx.fillRect(x + 3, y, 9, 3);
    ctx.fillStyle = "#e8d24a"; ctx.fillRect(x + (f > 0 ? -2 : 11), y + 1, 3, 2);
    ctx.fillStyle = "#cfd6e0";
    if (input.up && !input.left && !input.right) ctx.fillRect(x + 6, y - 6, 3, 11);
    else if (input.up) ctx.fillRect(x + (f > 0 ? 10 : -4), y + 1, 9, 3);
    else if (input.down && !p.onGround) ctx.fillRect(x + (f > 0 ? 10 : -4), y + 16, 9, 3);
    else ctx.fillRect(f > 0 ? x + 11 : x - 6, y + 11, 11, 3);
  }

  function drawDrop(d) {
    const y = Math.round(d.y + Math.sin(d.t * 2) * 1.5), x = Math.round(d.x);
    ctx.fillStyle = "#ff3b5c";
    ctx.fillRect(x - 5, y - 3, 4, 4); ctx.fillRect(x + 1, y - 3, 4, 4);
    ctx.fillRect(x - 5, y, 10, 3); ctx.fillRect(x - 3, y + 3, 6, 2); ctx.fillRect(x - 1, y + 5, 2, 2);
    ctx.fillStyle = "#ff8fa3"; ctx.fillRect(x - 4, y - 2, 2, 2);
  }
  function drawArenaWalls() {
    const glow = 0.4 + Math.sin(frame * 0.2) * 0.15;
    for (const wx of [arenaLeft, arenaLeft + VW]) {
      ctx.fillStyle = "rgba(255,80,60," + glow + ")"; ctx.fillRect(wx - 2, 0, 4, VH);
      ctx.fillStyle = "rgba(255,210,60,0.5)"; ctx.fillRect(wx - 1, 0, 2, VH);
    }
  }
  function drawMeleeFx() {
    const m = meleeFx, a = m.t / 8;
    ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(m.x, m.y, 14, m.f > 0 ? -0.9 : Math.PI - 0.9, m.f > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke();
    ctx.globalAlpha = 1; ctx.restore();
  }
  function drawBlasts() {
    for (const b of blasts) {
      const a = b.t / 16;
      ctx.globalAlpha = a * 0.5; ctx.fillStyle = "#ffd27a"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.strokeStyle = "#fff1b0"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.stroke();
      ctx.globalAlpha = a * 0.8; ctx.fillStyle = "#ff7a3c"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.5, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawPopups() {
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const q of popups) {
      ctx.globalAlpha = Math.min(1, q.t / 22);
      ctx.fillStyle = q.color; ctx.font = (q.big ? "900 16px" : "bold 11px") + " Trebuchet MS, sans-serif";
      ctx.fillText(q.text, q.x, q.y);
    }
    ctx.globalAlpha = 1; ctx.textAlign = "left";
  }

  const EMAP = { soldier: { key: "enemy_soldier", spd: 3 }, heavy: { key: "enemy_heavy", spd: 4 }, jumper: { key: "enemy_jumper", spd: 3 }, turret: { key: "enemy_turret", spd: 6 }, drone: { key: "enemy_drone", spd: 3 }, charger: { key: "enemy_charger", spd: 3 } };
  function drawEnemy(e) {
    const m = EMAP[e.type], im = m && IMG[m.key];
    if (m && im && im._ok && im.naturalWidth) {
      const fw = SPRITES[m.key].fw, fh = im.naturalHeight;
      const dh = e.h + 12, scale = dh / fh, dw = fw * scale;
      const dx = e.x + e.w / 2 - dw / 2, dy = e.y + e.h - dh + 3;
      if (e.flash > 0) ctx.filter = "brightness(4)";
      drawSprite(m.key, frame / m.spd + (e.x | 0), dx, dy, dw, dh, player.x > e.x);
      if (e.flash > 0) ctx.filter = "none";
      if (e.type === "heavy" || e.type === "turret") { ctx.fillStyle = "#ff5a5a"; for (let i = 0; i < Math.min(e.hp, 6); i++) ctx.fillRect(Math.round(dx) + i * 4, Math.round(dy) - 4, 3, 2); }
      return;
    }
    drawEnemyShapes(e);
  }
  function drawEnemyShapes(e) {
    const x = Math.round(e.x), y = Math.round(e.y), f = player.x > e.x ? 1 : -1;
    if (e.type === "soldier") {
      ctx.fillStyle = "#7a1f1f"; ctx.fillRect(x + 2, y + 18, 4, 8); ctx.fillRect(x + 8, y + 18, 4, 8);
      ctx.fillStyle = "#b03030"; ctx.fillRect(x + 2, y + 7, 10, 12);
      ctx.fillStyle = "#e0a878"; ctx.fillRect(x + 4, y + 1, 7, 7);
      ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x + 3, y, 9, 3);
      ctx.fillStyle = "#cfcf90"; ctx.fillRect(f > 0 ? x + 11 : x - 5, y + 10, 8, 2);
    } else if (e.type === "heavy") {
      ctx.fillStyle = "#3a0f0f"; ctx.fillRect(x + 2, y + 22, 6, 8); ctx.fillRect(x + 10, y + 22, 6, 8);
      ctx.fillStyle = "#8a1f1f"; ctx.fillRect(x, y + 8, 18, 15);
      ctx.fillStyle = "#5a1414"; ctx.fillRect(x, y + 8, 18, 4);
      ctx.fillStyle = "#e0a878"; ctx.fillRect(x + 6, y + 1, 8, 7);
      ctx.fillStyle = "#2a2a2a"; ctx.fillRect(x + 4, y, 11, 3);
      ctx.fillStyle = "#9aa"; ctx.fillRect(f > 0 ? x + 15 : x - 8, y + 12, 11, 3);
      ctx.fillStyle = "#ff5a5a"; for (let i = 0; i < Math.min(e.hp, 6); i++) ctx.fillRect(x + 1 + i * 3, y - 4, 2, 2);
    } else if (e.type === "jumper") {
      ctx.fillStyle = "#3a2466"; ctx.fillRect(x + 2, y + 16, 4, 6); ctx.fillRect(x + 8, y + 16, 4, 6);
      ctx.fillStyle = "#6a3fb0"; ctx.fillRect(x + 2, y + 6, 10, 11);
      ctx.fillStyle = "#f0c090"; ctx.fillRect(x + 4, y, 7, 7);
      ctx.fillStyle = "#2a164a"; ctx.fillRect(x + 3, y + 2, 9, 3);
      ctx.fillStyle = "#ff5a5a"; ctx.fillRect(x + (f > 0 ? 8 : 5), y + 3, 2, 1);
    } else if (e.type === "turret") {
      ctx.fillStyle = "#555f6b"; ctx.fillRect(x, y + 6, 18, 10);
      ctx.fillStyle = "#7a8794"; ctx.fillRect(x + 3, y, 12, 8);
      ctx.fillStyle = "#2a2f36"; ctx.fillRect(f > 0 ? x + 14 : x - 6, y + 3, 10, 3);
      ctx.fillStyle = "#ff5a5a"; for (let i = 0; i < e.hp; i++) ctx.fillRect(x + 2 + i * 5, y - 4, 3, 2);
    } else if (e.type === "drone") {
      ctx.fillStyle = "#9aa3ad"; ctx.fillRect(x, y + 5, 22, 6);
      ctx.fillStyle = "#5b636d"; ctx.fillRect(x + 6, y + 2, 10, 5);
      ctx.fillStyle = "#ff5a5a"; ctx.beginPath(); ctx.arc(x + 11, y + 8, 2, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(200,220,255,0.5)"; const rw = (frame % 6 < 3) ? 26 : 10; ctx.fillRect(x + 11 - rw / 2, y, rw, 2);
    }
  }

  function drawBoss() {
    if (IMG.boss && IMG.boss._ok) {
      const flip = player.x > boss.x + boss.w;        // art faces left; flip if player is on the right
      drawWhole("boss", boss.x + boss.w / 2, boss.y + boss.h + 4, boss.h * 1.7, flip, "bottom");
      if (boss.pulse > 0) {   // hit flash
        ctx.globalAlpha = boss.pulse / 30; ctx.fillStyle = "#ffffff";
        ctx.fillRect(boss.x - 30, boss.y - 30, boss.w + 60, boss.h + 40); ctx.globalAlpha = 1;
      }
      return;
    }
    const x = Math.round(boss.x), y = Math.round(boss.y), w = boss.w, h = boss.h, f = player.x < boss.x ? -1 : 1;
    const phase = boss.phase || 1;
    const hull = boss.pulse > 0 ? "#ffd0c0" : (phase === 1 ? "#4a5160" : phase === 2 ? "#5a4250" : "#5a2a2a");
    const coreCol = phase === 1 ? "#3fd0ff" : phase === 2 ? "#ffb13f" : "#ff3b30";
    // legs
    ctx.fillStyle = "#23262e";
    const lstep = Math.sin(boss.coreT * 3) * 3;
    ctx.fillRect(x + 8, y + h - 10, 8, 12 + lstep); ctx.fillRect(x + w - 16, y + h - 10, 8, 12 - lstep);
    // body
    ctx.fillStyle = hull; ctx.fillRect(x, y, w, h - 6);
    ctx.fillStyle = "#23262e"; ctx.fillRect(x + 5, y + 8, w - 10, h - 22);
    // armor plates / damage as HP drops
    ctx.fillStyle = "#161a20";
    for (let i = 0; i < phase + 1; i++) ctx.fillRect(x + 8 + i * 6, y + 4, 3, 3);
    // dome head
    ctx.fillStyle = hull; ctx.fillRect(x + w / 2 - 12, y - 8, 24, 12);
    // angry eyes
    ctx.fillStyle = coreCol; ctx.fillRect(x + w / 2 - 8, y - 4, 5, 3); ctx.fillRect(x + w / 2 + 3, y - 4, 5, 3);
    // glowing core
    const cx = x + w / 2, cy = y + h / 2 - 2, r = 11 + Math.sin(boss.coreT) * 2;
    const cg = ctx.createRadialGradient(cx, cy, 1, cx, cy, r + 4);
    cg.addColorStop(0, "#ffffff"); cg.addColorStop(0.45, coreCol); cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, 7); ctx.fill();
    // cannon facing player
    ctx.fillStyle = "#15181e"; ctx.fillRect(f < 0 ? x - 8 : x + w - 4, cy - 3, 12, 6);
  }
  function drawGrenade(g) {
    const x = Math.round(g.x), y = Math.round(g.y);
    ctx.fillStyle = "#2e3a24"; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
    ctx.fillStyle = "#5a7a3a"; ctx.fillRect(x - 1, y - 5, 2, 2);
    if (Math.floor(frame / 4) % 2 === 0) { ctx.fillStyle = "#ffec80"; ctx.fillRect(x - 1, y - 7, 2, 2); }
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(10,16,28,0.4)"; ctx.fillRect(0, 0, VW, 30);
    ctx.fillStyle = "#1a2436"; ctx.beginPath(); ctx.arc(18, 16, 13, 0, 7); ctx.fill();
    ctx.fillStyle = "#f0c090"; ctx.beginPath(); ctx.arc(18, 17, 9, 0, 7); ctx.fill();
    ctx.fillStyle = "#c0392b"; ctx.fillRect(10, 8, 16, 4);
    ctx.fillStyle = "#1a1a1a"; ctx.fillRect(20, 15, 2, 2);
    ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(18, 16, 13, 0, 7); ctx.stroke();
    const bx = 36, by = 7, bw = 96, bh = 9;
    ctx.fillStyle = "#0c1320"; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    const frac = player ? player.hp / player.hpMax : 0;
    const hg = ctx.createLinearGradient(bx, 0, bx + bw, 0); hg.addColorStop(0, "#9be35a"); hg.addColorStop(1, "#3fae3f");
    ctx.fillStyle = hg; ctx.fillRect(bx, by, bw * frac, bh);
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
    ctx.fillStyle = "#cfd6e0"; ctx.fillRect(38, 21, 12, 3); ctx.fillRect(38, 21, 3, 6);
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px Trebuchet MS, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("x" + lives, 54, 24);
    ctx.fillStyle = "#ffd23f"; ctx.font = "bold 10px Trebuchet MS, sans-serif";
    const wlabel = WEAPONS[player ? player.weapon : "default"].name + (player && player.owned.length > 1 ? " (" + player.owned.length + ")" : "");
    ctx.fillText(wlabel, 86, 24);
    if (godMode) { ctx.fillStyle = "#ffd23f"; ctx.font = "bold 10px Trebuchet MS, sans-serif"; ctx.fillText("★GOD", 150, 24); }
    // grenades + airstrikes
    ctx.fillStyle = "#9bd35a"; ctx.font = "bold 10px Trebuchet MS, sans-serif";
    ctx.fillText("✦x" + (player ? player.grenades : 0), 184, 24);
    ctx.fillStyle = "#9fd3ff"; ctx.fillText("✈x" + (player ? player.airstrikes : 0), 210, 24);
    // rage / berserk bar
    const ux = 230, uw = 86;
    ctx.fillStyle = "#0c1320"; ctx.fillRect(ux - 1, 6, uw + 2, 8);
    if (berserk > 0) {
      ctx.fillStyle = Math.floor(frame / 5) % 2 ? "#7CFC00" : "#b6ff66";
      ctx.fillRect(ux, 7, uw * (berserk / 420), 6);
      ctx.fillStyle = "#0a200a"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center"; ctx.fillText("BERSERK", ux + uw / 2, 13); ctx.textAlign = "left";
    } else {
      const ready = rage >= 100;
      ctx.fillStyle = ready ? (Math.floor(frame / 6) % 2 ? "#7CFC00" : "#ffd23f") : "#c0392b";
      ctx.fillRect(ux, 7, uw * (rage / 100), 6);
      ctx.fillStyle = "#fff"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center"; ctx.fillText(ready ? "RAGE! (R)" : "RAGE", ux + uw / 2, 13); ctx.textAlign = "left";
    }
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.strokeRect(ux + 0.5, 6.5, uw, 7);
    const coinX = VW - 92;
    ctx.fillStyle = "#caa31a"; ctx.beginPath(); ctx.arc(coinX, 15, 8, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(coinX, 15, 6, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 14px monospace"; ctx.textAlign = "left"; ctx.fillText(String(coinCount).padStart(3, "0"), coinX + 11, 16);
    ctx.fillStyle = "#cdd6e2"; ctx.font = "bold 9px monospace"; ctx.textAlign = "right"; ctx.fillText("LV" + level + "  SCORE " + String(score).padStart(6, "0"), VW - 56, 26);
    ctx.textAlign = "left";
    // combo meter
    if (combo >= 2) {
      const grow = 1 + Math.min(combo, 12) * 0.06, fresh = Math.min(1, comboTimer / 130);
      ctx.save(); ctx.translate(VW / 2, 52); ctx.scale(grow, grow);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = combo >= 6 ? "#ff5a3c" : "#ffd23f"; ctx.font = "900 15px Trebuchet MS, sans-serif";
      ctx.fillText("x" + combo + " COMBO", 0, 0);
      ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(-30, 10, 60, 3);
      ctx.fillStyle = "#ffd23f"; ctx.fillRect(-30, 10, 60 * fresh, 3);
      ctx.restore(); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    }
    if (boss.alive && boss.active) {
      ctx.fillStyle = "#000"; ctx.fillRect(VW / 2 - 81, 34, 162, 10);
      ctx.fillStyle = "#5a1a14"; ctx.fillRect(VW / 2 - 80, 35, 160, 8);
      ctx.fillStyle = "#ff3b30"; ctx.fillRect(VW / 2 - 80, 35, 160 * (boss.hp / boss.hpMax), 8);
      ctx.fillStyle = "#fff"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.fillText("BOSS", VW / 2, 36); ctx.textAlign = "left";
    } else if (player) {
      const prog = Math.min(1, player.x / (levelW - 160));
      ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(VW / 2 - 60, 34, 120, 3);
      ctx.fillStyle = "#5fe07a"; ctx.fillRect(VW / 2 - 60, 34, 120 * prog, 3);
    }
  }
  function drawBanner() {
    const a = Math.min(1, bannerT / 30) * Math.min(1, (130 - bannerT) / 15);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#ffd23f"; ctx.font = "900 30px Trebuchet MS, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("LEVEL " + level, VW / 2, VH / 2 - 12);
    ctx.fillStyle = "#fff"; ctx.font = "bold 14px Trebuchet MS, sans-serif"; ctx.fillText(LEVELS[level].name, VW / 2, VH / 2 + 12);
    ctx.globalAlpha = 1; ctx.textAlign = "left";
  }
  function drawPaused() {
    ctx.fillStyle = "rgba(6,10,18,0.6)"; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = "#ffd23f"; ctx.font = "900 32px Trebuchet MS, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("PAUSED", VW / 2, VH / 2 - 6);
    ctx.fillStyle = "#cfeaff"; ctx.font = "bold 12px Trebuchet MS, sans-serif"; ctx.fillText("tap ❚❚ or press P to resume · M = music", VW / 2, VH / 2 + 20);
    ctx.textAlign = "left";
  }

  // ============================================================
  //  Flow
  // ============================================================
  function showOverlay(id, scoreId, text) { if (scoreId) document.getElementById(scoreId).textContent = text; document.getElementById(id).classList.remove("hidden"); }
  function hideOverlay(id) { document.getElementById(id).classList.add("hidden"); }
  function togglePause() { if (gameState === "playing") gameState = "paused"; else if (gameState === "paused") gameState = "playing"; }
  function startGame() {
    initAudio(); resetGame(); gameState = "playing"; startMusic();
    hideOverlay("start-screen"); hideOverlay("gameover-screen"); hideOverlay("win-screen");
  }
  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);
  document.getElementById("shop-continue").addEventListener("click", continueShop);
  document.querySelectorAll("#shop-screen .shop-item").forEach((el, i) => bindTap(el, () => buyItem(i)));
  bindTap(document.getElementById("b-grenade"), throwGrenade);
  bindTap(document.getElementById("b-ult"), activateRage);
  bindTap(document.getElementById("b-ride"), toggleVehicle);
  bindTap(document.getElementById("b-air"), callAir);

  // ============================================================
  //  Main loop
  // ============================================================
  resetGame(); gameState = "menu";
  if (hiScore > 0) { const sub = document.querySelector("#start-screen .subtitle"); if (sub) sub.textContent = "JUNGLE RUN · BEST " + hiScore; }
  let acc = 0, last = performance.now(); const STEP = 1000 / 60;
  function loop(now) {
    acc += Math.min(now - last, 100); last = now;
    while (acc >= STEP) { update(); acc -= STEP; }
    draw(); requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
