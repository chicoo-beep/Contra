/* ============================================================
   CONTRA — Jungle Run
   Touch run-and-gun platformer. Pure canvas, code-drawn art,
   original synthesized music — no external assets.
   ============================================================ */
(function () {
  "use strict";

  const VW = 480, VH = 270;
  const GROUND_Y = 222;
  const GRAVITY = 0.55;

  const canvas = document.getElementById("screen");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

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
  const input = { left: false, right: false, up: false, down: false, jump: false, fire: false, jumpPressed: false };
  const keyMap = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down",
    KeyZ: "jump", Space: "jump", KeyK: "jump", KeyX: "fire", KeyJ: "fire", KeyL: "fire"
  };
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyP") { togglePause(); return; }
    if (e.code === "KeyM") { toggleMusic(); return; }
    const a = keyMap[e.code]; if (!a) return; e.preventDefault();
    if (a === "jump" && !input.jump) input.jumpPressed = true;
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
  document.getElementById("pause-btn").addEventListener("click", togglePause);

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
    jump:    () => tone(320, 0.16, "square", 0.18, 680),
    hit:     () => noise(0.08, 0.20, 2200),
    explode: () => { noise(0.35, 0.45, 900); tone(160, 0.3, "sawtooth", 0.18, 50); },
    coin:    () => { tone(988, 0.06, "square", 0.18); setTimeout(() => tone(1319, 0.10, "square", 0.18), 60); },
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
      pickups:  [[600,110,"S"],[1500,150,"F"],[2800,150,"R"]]
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
      pickups:  [[520,100,"F"],[2300,110,"R"],[3500,150,"S"]]
    }
  };

  // ============================================================
  //  State & helpers
  // ============================================================
  let player, bullets, eBullets, enemies, particles, pickups, coins, platforms, boss;
  let camX, score, lives, coinCount, shootCD, flashT, frame, gameState;
  let level, levelW, theme, fireMul, bannerT, pendingAdvance;

  function rect(x, y, w, h) { return { x, y, w, h }; }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  function makePlayer() {
    return { x: 40, y: GROUND_Y - 30, w: 14, h: 30, vx: 0, vy: 0, facing: 1,
      onGround: false, prone: false, weapon: "default", invuln: 0, hp: 4, hpMax: 4 };
  }
  function makeSoldier(x) { return { type: "soldier", x, y: GROUND_Y - 26, w: 14, h: 26, vx: 0, vy: 0, hp: 1, fireCD: (60 + Math.random() * 90) * fireMul, alive: true, active: false }; }
  function makeHeavy(x)   { return { type: "heavy", x, y: GROUND_Y - 30, w: 18, h: 30, vx: 0, vy: 0, hp: 5, fireCD: (70 + Math.random() * 40) * fireMul, alive: true, active: false }; }
  function makeJumper(x)  { return { type: "jumper", x, y: GROUND_Y - 22, w: 14, h: 22, vx: 0, vy: 0, hp: 2, jumpCD: 30 + Math.random() * 50, alive: true, active: false }; }
  function makeTurret(x, y) { return { type: "turret", x, y, w: 18, h: 16, hp: 3, fireCD: 90 * fireMul, alive: true, active: false }; }
  function makeDrone(x, y) { return { type: "drone", x, y, baseY: y, w: 22, h: 14, hp: 2, fireCD: (80 + Math.random() * 50) * fireMul, t: Math.random() * 6, alive: true, active: false }; }
  function makeBoss(hp) { return { x: levelW - 150, y: GROUND_Y - 80, w: 56, h: 80, hp, hpMax: hp, fireCD: 70, alive: true, active: false, coreT: 0, pulse: 0 }; }

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
    L.drones.forEach((d) => enemies.push(makeDrone(d[0], d[1])));
    coins = [];
    L.coinSpots.forEach((sx) => { for (let i = 0; i < 5; i++) coins.push({ x: sx + i * 18, y: 150 - Math.sin((i / 4) * Math.PI) * 34, taken: false, t: i }); });
    pickups = L.pickups.map((p) => ({ x: p[0], y: p[1], w: 16, h: 16, kind: p[2], t: 0 }));
    boss = makeBoss(L.bossHp);
    bullets = []; eBullets = []; particles = [];
    player.x = 40; player.y = GROUND_Y - 30; player.vx = 0; player.vy = 0; player.prone = false;
    player.hp = player.hpMax; player.invuln = 100;
    camX = 0; shootCD = 0; bannerT = 130;
  }
  function resetGame() {
    player = makePlayer();
    score = 0; lives = 10; coinCount = 0; flashT = 0; frame = 0; pendingAdvance = false;
    loadLevel(1);
  }
  function advanceLevel() { SFX.fanfare(); loadLevel(2); }

  // ============================================================
  //  Combat
  // ============================================================
  function aimVector() {
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
      const sp = 4.2, base = Math.atan2(uy, ux);
      for (let i = 0; i < 3; i++) { const ang = base + (Math.random() - 0.5) * 0.5, s = sp * (0.7 + Math.random() * 0.6); bullets.push({ kind: "flame", x: mx, y: my, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, r: 2.5, dmg: 1, life: 16 }); }
      SFX.flame();
    } else if (w === "rocket") {
      const sp = 4.4; bullets.push({ kind: "rocket", x: mx, y: my, vx: ux * sp, vy: uy * sp, r: 5, dmg: 9 });
      SFX.rocket();
    } else {
      const sp = 6.6; bullets.push({ kind: "bullet", x: mx, y: my, vx: ux * sp, vy: uy * sp, r: 3, dmg: 2, spread: false });
      SFX.shoot();
    }
    shootCD = WEAPONS[w].cd;
  }
  function enemyShoot(ex, ey, tx, ty, speed) { const ang = Math.atan2(ty - ey, tx - ex); eBullets.push({ x: ex, y: ey, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 3 }); }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 18 + Math.random() * 14, color }); }
  }
  function killReward(e) { score += e.type === "turret" ? 300 : e.type === "drone" ? 200 : e.type === "heavy" ? 250 : 100; burst(e.x + e.w / 2, e.y + e.h / 2, "#ff8c3f", 16); SFX.explode(); }
  function hurtEnemy(e, dmg) { if (!e.alive) return; e.hp -= dmg; if (e.hp <= 0) { e.alive = false; killReward(e); } else SFX.hit(); }
  function hurtBoss(dmg) {
    if (!boss.alive) return;
    boss.hp -= dmg; boss.pulse = 6; score += Math.ceil(dmg); SFX.bossHit();
    if (boss.hp <= 0) {
      boss.alive = false; burst(boss.x + 28, boss.y + 40, "#ff5a3c", 60); score += 2000; SFX.bossDie();
      if (level === 1) pendingAdvance = true;     // defer level switch to end of frame (avoids mid-loop array swap)
      else { gameState = "win"; SFX.fanfare(); showOverlay("win-screen", "win-score", "SCORE " + score); }
    }
  }
  function explodeAt(x, y, radius, dmg) {
    burst(x, y, "#ffb13f", 26); burst(x, y, "#ffec80", 14); SFX.explode();
    for (const e of enemies) { if (!e.alive) continue; if (dist(e.x + e.w / 2, e.y + e.h / 2, x, y) < radius) hurtEnemy(e, dmg); }
    if (boss.alive && boss.active && dist(boss.x + boss.w / 2, boss.y + boss.h / 2, x, y) < radius + 22) hurtBoss(dmg);
  }
  function playerHit() {
    if (player.invuln > 0) return;
    player.hp--; flashT = 8; SFX.hurt(); burst(player.x + 7, player.y + 15, "#ff5050", 20);
    if (player.hp <= 0) {
      lives--;
      if (lives <= 0) { gameState = "over"; SFX.over(); showOverlay("gameover-screen", "over-score", "SCORE " + score); }
      else { const w = player.weapon; player = makePlayer(); player.weapon = w; player.x = camX + 40; player.invuln = 150; }
    } else player.invuln = 70;
  }

  // ============================================================
  //  Update
  // ============================================================
  function update() {
    frame++;
    if (portraitBlocked || gameState !== "playing") return;
    if (flashT > 0) flashT--;
    if (bannerT > 0) bannerT--;
    const p = player;
    if (p.invuln > 0) p.invuln--;

    const ACC = 1.0, MAXV = 3.6, FRICT = 0.78;
    p.prone = input.down && p.onGround && !(input.left || input.right);
    if (input.left) { p.vx -= ACC; p.facing = -1; }
    if (input.right) { p.vx += ACC; p.facing = 1; }
    if (!input.left && !input.right) p.vx *= FRICT;
    p.vx = Math.max(-MAXV, Math.min(MAXV, p.vx));
    if (input.jumpPressed && p.onGround) { p.vy = -9.6; p.onGround = false; SFX.jump(); }
    input.jumpPressed = false;
    p.vy += GRAVITY; if (p.vy > 12) p.vy = 12;
    p.x += p.vx; if (p.x < 0) p.x = 0; if (p.x > levelW - p.w) p.x = levelW - p.w;
    p.h = p.prone ? 18 : 30;
    p.y += p.vy; p.onGround = false;
    if (p.y + p.h >= GROUND_Y) { p.y = GROUND_Y - p.h; p.vy = 0; p.onGround = true; }
    for (const pl of platforms) {
      const wasAbove = p.y + p.h - p.vy <= pl.y + 2;
      if (p.vy >= 0 && wasAbove && p.x + p.w > pl.x && p.x < pl.x + pl.w && p.y + p.h >= pl.y && p.y + p.h <= pl.y + pl.h + 12) { p.y = pl.y - p.h; p.vy = 0; p.onGround = true; }
    }
    if (shootCD > 0) shootCD--;
    if (input.fire && shootCD <= 0) firePlayer();

    const target = p.x - VW * 0.38;
    camX += (target - camX) * 0.12;
    if (camX < 0) camX = 0; if (camX > levelW - VW) camX = levelW - VW;

    // player projectiles
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; b.x += b.vx; b.y += b.vy;
      if (b.kind === "flame") { b.life--; b.r += 0.22; b.vy += 0.03; if (b.life <= 0) { bullets.splice(i, 1); continue; } }
      if (b.x < camX - 30 || b.x > camX + VW + 30 || b.y < -30 || b.y > VH + 30) { bullets.splice(i, 1); continue; }
      let hit = false; const bb = rect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      for (const e of enemies) {
        if (!e.alive) continue;
        if (overlap(bb, e)) { if (b.kind === "rocket") explodeAt(b.x, b.y, 48, b.dmg); else hurtEnemy(e, b.dmg); hit = true; break; }
      }
      if (!hit && boss.alive && boss.active && overlap(bb, boss)) { if (b.kind === "rocket") explodeAt(b.x, b.y, 48, b.dmg); else hurtBoss(b.dmg); hit = true; }
      if (hit) bullets.splice(i, 1);
    }
    // deferred level transition (boss of level 1 cleared)
    if (pendingAdvance) { pendingAdvance = false; advanceLevel(); return; }

    // enemies
    for (const e of enemies) {
      if (!e.alive) continue;
      if (!e.active && e.x < camX + VW + 60 && e.x > camX - 80) e.active = true;
      if (!e.active) continue;
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
      }
      if (overlap(p, e)) playerHit();
    }

    if (boss.alive) {
      if (!boss.active && camX > levelW - VW - 30) boss.active = true;
      if (boss.active) {
        boss.coreT += 0.06; if (boss.pulse > 0) boss.pulse--;
        if (--boss.fireCD <= 0) {
          const cx = boss.x + 10, cy = boss.y + boss.h / 2, spread = level === 2 ? 2 : 1;
          for (let a = -spread; a <= spread; a++) { const ang = Math.atan2((p.y + 12) - cy, p.x - cx) + a * 0.24; eBullets.push({ x: cx, y: cy, vx: Math.cos(ang) * 3, vy: Math.sin(ang) * 3, r: 4 }); }
          boss.fireCD = level === 2 ? 45 : 55;
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
    for (const pk of pickups) { if (pk.taken) continue; pk.t += 0.1; if (overlap(p, pk)) { pk.taken = true; player.weapon = PICKUP_WEAPON[pk.kind] || "spread"; score += 50; SFX.power(); burst(pk.x + 8, pk.y + 8, "#3fd0ff", 18); } }
    for (let i = particles.length - 1; i >= 0; i--) { const pt = particles[i]; pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.15; pt.life--; if (pt.life <= 0) particles.splice(i, 1); }
    if (p.y > VH + 40) playerHit();
  }

  // ============================================================
  //  Rendering
  // ============================================================
  function draw() {
    drawSky(); drawHills(); drawVillage();
    ctx.save(); ctx.translate(-Math.round(camX), 0);
    drawGround(); platforms.forEach(drawPlatform); coins.forEach(drawCoin); pickups.forEach(drawPickup);
    enemies.forEach((e) => e.alive && drawEnemy(e));
    if (boss.alive) drawBoss();
    drawBullets();
    ctx.fillStyle = "#ff5a5a"; for (const b of eBullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); }
    drawPlayer();
    for (const pt of particles) { ctx.globalAlpha = Math.max(0, pt.life / 24); ctx.fillStyle = pt.color; ctx.fillRect(pt.x - 1, pt.y - 1, 3, 3); }
    ctx.globalAlpha = 1; ctx.restore();
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

  function drawPlayer() {
    const p = player;
    if (p.invuln > 0 && Math.floor(frame / 4) % 2 === 0) return;
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

  function drawEnemy(e) {
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
    const x = Math.round(boss.x), y = Math.round(boss.y);
    ctx.fillStyle = boss.pulse > 0 ? "#ff7a5c" : "#444b57"; ctx.fillRect(x, y, boss.w, boss.h);
    ctx.fillStyle = "#2c313b"; ctx.fillRect(x + 4, y + 6, boss.w - 8, boss.h - 12);
    const cx = x + 12, cy = y + boss.h / 2, r = 9 + Math.sin(boss.coreT) * 2;
    const cg = ctx.createRadialGradient(cx, cy, 1, cx, cy, r + 3);
    cg.addColorStop(0, "#fff2a0"); cg.addColorStop(0.5, "#ff8c2a"); cg.addColorStop(1, "rgba(255,60,30,0)");
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, 7); ctx.fill();
    ctx.fillStyle = "#1c2026"; for (let i = 0; i < 5; i++) ctx.fillRect(x + boss.w - 7, y + 8 + i * 14, 3, 3);
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
    ctx.fillStyle = "#ffd23f"; ctx.font = "bold 10px Trebuchet MS, sans-serif"; ctx.fillText(WEAPONS[player ? player.weapon : "default"].name, 86, 24);
    const coinX = VW - 92;
    ctx.fillStyle = "#caa31a"; ctx.beginPath(); ctx.arc(coinX, 15, 8, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(coinX, 15, 6, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 14px monospace"; ctx.textAlign = "left"; ctx.fillText(String(coinCount).padStart(3, "0"), coinX + 11, 16);
    ctx.fillStyle = "#cdd6e2"; ctx.font = "bold 9px monospace"; ctx.textAlign = "right"; ctx.fillText("LV" + level + "  SCORE " + String(score).padStart(6, "0"), VW - 56, 26);
    ctx.textAlign = "left";
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

  // ============================================================
  //  Main loop
  // ============================================================
  resetGame(); gameState = "menu";
  let acc = 0, last = performance.now(); const STEP = 1000 / 60;
  function loop(now) {
    acc += Math.min(now - last, 100); last = now;
    while (acc >= STEP) { update(); acc -= STEP; }
    draw(); requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
