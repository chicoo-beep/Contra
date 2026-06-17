/* ============================================================
   CONTRA — Jungle Run
   A touch-controlled HTML5 run-and-gun vertical slice.
   Pure canvas, code-drawn pixel art, no external assets.
   ============================================================ */
(function () {
  "use strict";

  // ---- Virtual resolution (16:9, low-res for crisp pixel look) ----
  const VW = 480, VH = 270;
  const GROUND_Y = 222;          // top of the main ground band
  const GRAVITY = 0.55;
  const LEVEL_W = 4200;          // total world length in px

  const canvas = document.getElementById("screen");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // ---- Responsive scaling: fit the virtual canvas to the screen ----
  function resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    const scale = Math.min(ww / VW, wh / VH);
    canvas.style.width = Math.floor(VW * scale) + "px";
    canvas.style.height = Math.floor(VH * scale) + "px";
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 150));
  resize();

  // ---- Detect touch device to show on-screen controls ----
  const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  const touchUI = document.getElementById("touch-ui");
  if (isTouch) { touchUI.style.display = "block"; document.body.classList.add("touch"); }

  // ============================================================
  //  Input
  // ============================================================
  const input = { left: false, right: false, up: false, down: false, jump: false, fire: false, jumpPressed: false };

  // Keyboard
  const keyMap = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down",
    KeyZ: "jump", Space: "jump", KeyK: "jump",
    KeyX: "fire", KeyJ: "fire", KeyL: "fire"
  };
  window.addEventListener("keydown", (e) => {
    const a = keyMap[e.code];
    if (!a) return;
    e.preventDefault();
    if (a === "jump" && !input.jump) input.jumpPressed = true;
    input[a] = true;
  }, { passive: false });
  window.addEventListener("keyup", (e) => {
    const a = keyMap[e.code];
    if (!a) return;
    e.preventDefault();
    input[a] = false;
  }, { passive: false });

  // Touch buttons — track by element so multitouch works
  function bindHold(el, on, off) {
    const start = (e) => { e.preventDefault(); el.classList.add("active"); on(); };
    const end = (e) => { e.preventDefault(); el.classList.remove("active"); off(); };
    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchend", end, { passive: false });
    el.addEventListener("touchcancel", end, { passive: false });
    // mouse fallback for desktop testing of the UI
    el.addEventListener("mousedown", start);
    window.addEventListener("mouseup", () => { el.classList.remove("active"); off(); });
  }
  document.querySelectorAll(".dbtn[data-dir]").forEach((el) => {
    const dir = el.dataset.dir;
    bindHold(el, () => (input[dir] = true), () => (input[dir] = false));
  });
  const jumpBtn = document.getElementById("btn-jump");
  const fireBtn = document.getElementById("btn-fire");
  bindHold(jumpBtn, () => { if (!input.jump) input.jumpPressed = true; input.jump = true; }, () => (input.jump = false));
  bindHold(fireBtn, () => (input.fire = true), () => (input.fire = false));

  // ============================================================
  //  Game state
  // ============================================================
  let player, bullets, eBullets, enemies, particles, pickups, platforms, boss;
  let camX, score, lives, gameState, shootCD, flashT, frame;
  // gameState: "menu" | "playing" | "dead" | "over" | "win"

  function rect(x, y, w, h) { return { x, y, w, h }; }
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function makePlayer() {
    return {
      x: 40, y: GROUND_Y - 30, w: 14, h: 30,
      vx: 0, vy: 0, facing: 1, onGround: false, prone: false,
      weapon: "default", invuln: 0, aimUp: false
    };
  }

  // Level layout: floating platforms (world coords)
  function buildPlatforms() {
    return [
      rect(360, 172, 90, 10),
      rect(560, 140, 80, 10),
      rect(720, 178, 100, 10),
      rect(980, 150, 90, 10),
      rect(1180, 120, 80, 10),
      rect(1360, 175, 110, 10),
      rect(1680, 160, 90, 10),
      rect(1880, 128, 80, 10),
      rect(2080, 170, 100, 10),
      rect(2380, 150, 90, 10),
      rect(2620, 175, 110, 10),
      rect(2960, 145, 90, 10),
      rect(3200, 175, 120, 10)
    ];
  }

  function buildEnemies() {
    const list = [];
    // Running soldiers (run toward player, shoot occasionally)
    const soldierX = [430, 640, 900, 1240, 1500, 1760, 2010, 2300, 2540, 2860, 3080, 3320];
    soldierX.forEach((x) => list.push(makeSoldier(x)));
    // Stationary turrets on platforms
    list.push(makeTurret(720, 178 - 16));
    list.push(makeTurret(1360, 175 - 16));
    list.push(makeTurret(2080, 170 - 16));
    list.push(makeTurret(2620, 175 - 16));
    return list;
  }

  function makeSoldier(x) {
    return { type: "soldier", x, y: GROUND_Y - 26, w: 14, h: 26, vx: 0, vy: 0,
      hp: 1, onGround: false, fireCD: 60 + Math.random() * 90, alive: true, active: false };
  }
  function makeTurret(x, y) {
    return { type: "turret", x, y, w: 18, h: 16, hp: 3, fireCD: 90, alive: true, active: false };
  }

  function makeBoss() {
    return {
      x: LEVEL_W - 150, y: GROUND_Y - 80, w: 56, h: 80,
      hp: 40, hpMax: 40, fireCD: 70, alive: true, active: false,
      coreT: 0, pulse: 0
    };
  }

  function resetGame() {
    player = makePlayer();
    bullets = [];
    eBullets = [];
    particles = [];
    pickups = [
      { x: 600, y: 120, w: 16, h: 16, kind: "S", t: 0 },     // spread gun pod
      { x: 2000, y: 150, w: 16, h: 16, kind: "S", t: 0 }
    ];
    platforms = buildPlatforms();
    enemies = buildEnemies();
    boss = makeBoss();
    camX = 0; score = 0; lives = 3;
    shootCD = 0; flashT = 0; frame = 0;
  }

  // ============================================================
  //  Spawning helpers
  // ============================================================
  function firePlayer() {
    const speed = 6.4;
    let dx = player.facing, dy = 0;
    // 8-direction aiming based on dpad
    const up = input.up, down = input.down && !player.onGround;
    if (up && (input.left || input.right)) { dx = player.facing; dy = -1; }
    else if (up) { dx = 0; dy = -1; }
    else if (down && (input.left || input.right)) { dx = player.facing; dy = 1; }
    else { dx = player.facing; dy = 0; }
    const mag = Math.hypot(dx, dy) || 1;
    const nx = (dx / mag) * speed, ny = (dy / mag) * speed;
    const muzzleX = player.x + player.w / 2 + dx * 8;
    const muzzleY = player.y + (player.prone ? player.h - 6 : 10);

    if (player.weapon === "spread") {
      for (let a = -2; a <= 2; a++) {
        const ang = Math.atan2(ny, nx) + a * 0.16;
        bullets.push({ x: muzzleX, y: muzzleY, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 3, spread: true });
      }
    } else {
      bullets.push({ x: muzzleX, y: muzzleY, vx: nx, vy: ny, r: 2, spread: false });
    }
    shootCD = player.weapon === "spread" ? 9 : 7;
  }

  function enemyShoot(ex, ey, tx, ty, speed) {
    const ang = Math.atan2(ty - ey, tx - ex);
    eBullets.push({ x: ex, y: ey, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 3 });
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 18 + Math.random() * 14, color });
    }
  }

  function playerHit() {
    if (player.invuln > 0) return;
    lives--;
    flashT = 8;
    burst(player.x + 7, player.y + 15, "#ff5050", 22);
    if (lives <= 0) {
      gameState = "over";
      showOverlay("gameover-screen", "over-score", "SCORE " + score);
    } else {
      // respawn near current camera position
      player = makePlayer();
      player.x = camX + 40;
      player.invuln = 110;
    }
  }

  // ============================================================
  //  Update
  // ============================================================
  function update() {
    frame++;
    if (gameState !== "playing") return;
    if (flashT > 0) flashT--;

    const p = player;
    if (p.invuln > 0) p.invuln--;

    // --- Horizontal movement ---
    const ACC = 0.8, MAXV = 2.6, FRICT = 0.75;
    p.prone = input.down && p.onGround && !(input.left || input.right);
    if (input.left) { p.vx -= ACC; p.facing = -1; }
    if (input.right) { p.vx += ACC; p.facing = 1; }
    if (!input.left && !input.right) p.vx *= FRICT;
    p.vx = Math.max(-MAXV, Math.min(MAXV, p.vx));

    // --- Jump ---
    if (input.jumpPressed && p.onGround) { p.vy = -8.6; p.onGround = false; }
    input.jumpPressed = false;
    // drop through? (down + jump on a platform) — keep simple: no drop-through

    // --- Gravity ---
    p.vy += GRAVITY;
    if (p.vy > 12) p.vy = 12;

    // --- Apply X, clamp to world ---
    p.x += p.vx;
    if (p.x < 0) p.x = 0;
    if (p.x > LEVEL_W - p.w) p.x = LEVEL_W - p.w;

    p.h = p.prone ? 18 : 30;

    // --- Apply Y + collisions ---
    p.y += p.vy;
    p.onGround = false;
    // main ground
    if (p.y + p.h >= GROUND_Y) { p.y = GROUND_Y - p.h; p.vy = 0; p.onGround = true; }
    // platforms (one-way, land from above)
    for (const pl of platforms) {
      const wasAbove = p.y + p.h - p.vy <= pl.y + 2;
      if (p.vy >= 0 && wasAbove &&
          p.x + p.w > pl.x && p.x < pl.x + pl.w &&
          p.y + p.h >= pl.y && p.y + p.h <= pl.y + pl.h + 12) {
        p.y = pl.y - p.h; p.vy = 0; p.onGround = true;
      }
    }

    // --- Shooting ---
    if (shootCD > 0) shootCD--;
    if (input.fire && shootCD <= 0) firePlayer();

    // --- Camera follows player (player held ~40% from left) ---
    const target = p.x - VW * 0.38;
    camX += (target - camX) * 0.12;
    if (camX < 0) camX = 0;
    if (camX > LEVEL_W - VW) camX = LEVEL_W - VW;

    // --- Player bullets ---
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx; b.y += b.vy;
      if (b.x < camX - 20 || b.x > camX + VW + 20 || b.y < -20 || b.y > VH + 20) {
        bullets.splice(i, 1); continue;
      }
      let hit = false;
      const bb = rect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      for (const e of enemies) {
        if (!e.alive) continue;
        if (overlap(bb, e)) {
          e.hp--; hit = true;
          burst(b.x, b.y, "#ffd23f", 5);
          if (e.hp <= 0) { e.alive = false; score += e.type === "turret" ? 300 : 100; burst(e.x + e.w / 2, e.y + e.h / 2, "#ff8c3f", 16); }
          break;
        }
      }
      // boss hit
      if (!hit && boss.alive && boss.active && overlap(bb, boss)) {
        boss.hp--; hit = true; boss.pulse = 6;
        burst(b.x, b.y, "#ffef7a", 6);
        score += 5;
        if (boss.hp <= 0) {
          boss.alive = false;
          for (let k = 0; k < 6; k++) setTimeout(() => {}, 0);
          burst(boss.x + boss.w / 2, boss.y + boss.h / 2, "#ff5a3c", 60);
          score += 2000;
          gameState = "win";
          showOverlay("win-screen", "win-score", "SCORE " + score);
        }
      }
      if (hit) bullets.splice(i, 1);
    }

    // --- Enemies AI ---
    for (const e of enemies) {
      if (!e.alive) continue;
      // activate when near the camera view
      if (!e.active && e.x < camX + VW + 40 && e.x > camX - 60) e.active = true;
      if (!e.active) continue;

      if (e.type === "soldier") {
        const dir = p.x > e.x ? 1 : -1;
        e.vx = dir * 0.7;
        e.x += e.vx;
        // gravity for soldiers
        e.vy += GRAVITY; e.y += e.vy;
        if (e.y + e.h >= GROUND_Y) { e.y = GROUND_Y - e.h; e.vy = 0; }
        e.fireCD--;
        if (e.fireCD <= 0 && Math.abs(e.x - p.x) < 220) {
          enemyShoot(e.x + e.w / 2, e.y + 8, p.x + p.w / 2, p.y + 12, 2.6);
          e.fireCD = 110 + Math.random() * 60;
        }
      } else if (e.type === "turret") {
        e.fireCD--;
        if (e.fireCD <= 0 && Math.abs(e.x - p.x) < 240) {
          enemyShoot(e.x + e.w / 2, e.y + 6, p.x + p.w / 2, p.y + 12, 2.3);
          e.fireCD = 95;
        }
      }
      // touch damage
      if (overlap(p, e)) playerHit();
    }

    // --- Boss ---
    if (boss.alive) {
      if (!boss.active && camX > LEVEL_W - VW - 30) boss.active = true;
      if (boss.active) {
        boss.coreT += 0.06; boss.fireCD--;
        if (boss.pulse > 0) boss.pulse--;
        if (boss.fireCD <= 0) {
          // 3-way aimed volley
          const cx = boss.x + 10, cy = boss.y + boss.h / 2;
          for (let a = -1; a <= 1; a++) {
            const ang = Math.atan2((p.y + 12) - cy, (p.x) - cx) + a * 0.28;
            eBullets.push({ x: cx, y: cy, vx: Math.cos(ang) * 3.0, vy: Math.sin(ang) * 3.0, r: 4 });
          }
          boss.fireCD = 55;
        }
        if (overlap(p, boss)) playerHit();
      }
    }

    // --- Enemy bullets ---
    for (let i = eBullets.length - 1; i >= 0; i--) {
      const b = eBullets[i];
      b.x += b.vx; b.y += b.vy;
      if (b.x < camX - 30 || b.x > camX + VW + 30 || b.y < -30 || b.y > VH + 30) {
        eBullets.splice(i, 1); continue;
      }
      const bb = rect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      if (overlap(bb, p)) { eBullets.splice(i, 1); playerHit(); }
    }

    // --- Pickups ---
    for (const pk of pickups) {
      if (pk.taken) continue;
      pk.t += 0.1;
      if (overlap(p, pk)) {
        pk.taken = true;
        player.weapon = "spread";
        score += 50;
        burst(pk.x + 8, pk.y + 8, "#3fd0ff", 18);
      }
    }

    // --- Particles ---
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.15; pt.life--;
      if (pt.life <= 0) particles.splice(i, 1);
    }

    // --- Fell in a pit? (none here, ground is solid) — safety clamp ---
    if (p.y > VH + 40) playerHit();
  }

  // ============================================================
  //  Rendering (code-drawn pixel art)
  // ============================================================
  function draw() {
    // Sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, "#1d3b56");
    g.addColorStop(0.6, "#27506b");
    g.addColorStop(1, "#356b54");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    drawParallax();

    ctx.save();
    ctx.translate(-Math.round(camX), 0);

    drawGround();
    platforms.forEach(drawPlatform);
    pickups.forEach(drawPickup);
    enemies.forEach((e) => e.alive && drawEnemy(e));
    if (boss.alive) drawBoss();

    // bullets
    for (const b of bullets) {
      ctx.fillStyle = b.spread ? "#ff9f1c" : "#fff36b";
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 1, 0, 7); ctx.fill();
    }
    ctx.fillStyle = "#ff5a5a";
    for (const b of eBullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); }

    drawPlayer();

    // particles
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life / 24);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 1, pt.y - 1, 3, 3);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    drawHUD();

    // hit flash
    if (flashT > 0) {
      ctx.fillStyle = "rgba(255,40,40," + (flashT / 18) + ")";
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  function drawParallax() {
    // distant mountains
    ctx.fillStyle = "#2c4a40";
    const off = camX * 0.25;
    for (let i = -1; i < 8; i++) {
      const bx = i * 140 - (off % 140);
      ctx.beginPath();
      ctx.moveTo(bx, 180); ctx.lineTo(bx + 70, 95); ctx.lineTo(bx + 140, 180);
      ctx.closePath(); ctx.fill();
    }
    // mid trees
    ctx.fillStyle = "#1f3e2f";
    const off2 = camX * 0.5;
    for (let i = -1; i < 12; i++) {
      const bx = i * 90 - (off2 % 90);
      ctx.fillRect(bx + 30, 150, 6, 40);
      ctx.beginPath(); ctx.arc(bx + 33, 145, 18, 0, 7); ctx.fill();
    }
  }

  function drawGround() {
    const x0 = camX - 10, w = VW + 20;
    ctx.fillStyle = "#3a2a1c";
    ctx.fillRect(x0, GROUND_Y, w, VH - GROUND_Y);
    ctx.fillStyle = "#4d7a3a";
    ctx.fillRect(x0, GROUND_Y, w, 6);
    // dirt texture dots
    ctx.fillStyle = "#2c2014";
    for (let x = Math.floor(x0 / 18) * 18; x < x0 + w; x += 18) {
      ctx.fillRect(x + ((x * 7) % 12), GROUND_Y + 14, 3, 3);
      ctx.fillRect(x + ((x * 5) % 14) + 6, GROUND_Y + 28, 2, 2);
    }
  }

  function drawPlatform(pl) {
    ctx.fillStyle = "#5a4632";
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.fillStyle = "#6f8f3f";
    ctx.fillRect(pl.x, pl.y, pl.w, 4);
    ctx.fillStyle = "#3a2c1e";
    for (let x = 0; x < pl.w; x += 12) ctx.fillRect(pl.x + x + 4, pl.y + 6, 2, 2);
  }

  function drawPickup(pk) {
    if (pk.taken) return;
    const bob = Math.sin(pk.t) * 3;
    const x = pk.x, y = pk.y + bob;
    ctx.fillStyle = "#101820";
    ctx.fillRect(x - 1, y - 1, 18, 18);
    ctx.fillStyle = "#e7402c";
    ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = "#ffd23f";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(pk.kind, x + 8, y + 9);
  }

  function drawPlayer() {
    const p = player;
    if (p.invuln > 0 && Math.floor(frame / 4) % 2 === 0) return; // blink
    const x = Math.round(p.x), y = Math.round(p.y), f = p.facing;
    const skin = "#f0c090", suit = p.weapon === "spread" ? "#e85d4e" : "#3b6fd4", boot = "#26324a";

    if (p.prone) {
      ctx.fillStyle = suit; ctx.fillRect(x - 2, y + 6, 20, 8);
      ctx.fillStyle = skin; ctx.fillRect(x + (f > 0 ? 16 : -4), y + 6, 4, 4);
      ctx.fillStyle = "#cfd6e0"; // gun
      ctx.fillRect(x + (f > 0 ? 18 : -8), y + 8, 8, 2);
      return;
    }
    // legs (simple run cycle)
    const stepping = Math.abs(p.vx) > 0.3 && p.onGround;
    const sw = stepping ? (Math.floor(frame / 6) % 2 === 0 ? 3 : -3) : 0;
    ctx.fillStyle = boot;
    ctx.fillRect(x + 2 - sw, y + 20, 4, 10);
    ctx.fillRect(x + 8 + sw, y + 20, 4, 10);
    // torso
    ctx.fillStyle = suit;
    ctx.fillRect(x + 2, y + 8, 10, 13);
    // head
    ctx.fillStyle = skin;
    ctx.fillRect(x + 4, y + 1, 7, 7);
    ctx.fillStyle = "#c0392b"; // bandana
    ctx.fillRect(x + 3, y, 9, 3);

    // arm + gun, direction based on aim
    ctx.fillStyle = "#cfd6e0";
    const gy = y + 11;
    if (input.up && !input.left && !input.right) {
      ctx.fillRect(x + 6, y - 6, 3, 10);                  // straight up
    } else if (input.up) {
      ctx.fillRect(x + (f > 0 ? 10 : -4), y + 2, 8, 3);   // diagonal up
    } else if (input.down && !p.onGround) {
      ctx.fillRect(x + (f > 0 ? 10 : -4), y + 16, 8, 3);  // diagonal down (jumping)
    } else {
      ctx.fillRect(f > 0 ? x + 11 : x - 5, gy, 10, 3);    // straight ahead
    }
  }

  function drawEnemy(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    if (e.type === "soldier") {
      const f = player.x > e.x ? 1 : -1;
      ctx.fillStyle = "#7a1f1f"; ctx.fillRect(x + 2, y + 18, 4, 8); ctx.fillRect(x + 8, y + 18, 4, 8);
      ctx.fillStyle = "#b03030"; ctx.fillRect(x + 2, y + 7, 10, 12); // body
      ctx.fillStyle = "#e0a878"; ctx.fillRect(x + 4, y + 1, 7, 7);  // head
      ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x + 3, y, 9, 3);       // helmet
      ctx.fillStyle = "#cfcf90"; ctx.fillRect(f > 0 ? x + 11 : x - 5, y + 10, 8, 2); // gun
    } else { // turret
      ctx.fillStyle = "#555f6b"; ctx.fillRect(x, y + 6, 18, 10);
      ctx.fillStyle = "#7a8794"; ctx.fillRect(x + 3, y, 12, 8);
      ctx.fillStyle = "#2a2f36";
      const f = player.x > e.x ? 1 : -1;
      ctx.fillRect(f > 0 ? x + 14 : x - 6, y + 3, 10, 3);
      // hp pips
      ctx.fillStyle = "#ff5a5a";
      for (let i = 0; i < e.hp; i++) ctx.fillRect(x + 2 + i * 5, y - 4, 3, 2);
    }
  }

  function drawBoss() {
    const x = Math.round(boss.x), y = Math.round(boss.y);
    // body
    ctx.fillStyle = boss.pulse > 0 ? "#ff7a5c" : "#444b57";
    ctx.fillRect(x, y, boss.w, boss.h);
    ctx.fillStyle = "#2c313b";
    ctx.fillRect(x + 4, y + 6, boss.w - 8, boss.h - 12);
    // glowing core
    const cx = x + 10, cy = y + boss.h / 2;
    const r = 9 + Math.sin(boss.coreT) * 2;
    const cg = ctx.createRadialGradient(cx, cy, 1, cx, cy, r + 3);
    cg.addColorStop(0, "#fff2a0"); cg.addColorStop(0.5, "#ff8c2a"); cg.addColorStop(1, "rgba(255,60,30,0)");
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, 7); ctx.fill();
    // rivets
    ctx.fillStyle = "#1c2026";
    for (let i = 0; i < 5; i++) { ctx.fillRect(x + boss.w - 7, y + 8 + i * 14, 3, 3); }
    // boss hp bar (screen-space drawn in HUD)
  }

  // ---- HUD ----
  function drawHUD() {
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, VW, 18);
    // lives
    ctx.fillStyle = "#ffd23f";
    ctx.font = "bold 11px monospace";
    ctx.fillText("LIVES", 6, 4);
    for (let i = 0; i < lives; i++) {
      const lx = 44 + i * 12;
      ctx.fillStyle = "#3b6fd4"; ctx.fillRect(lx, 4, 6, 10);
      ctx.fillStyle = "#c0392b"; ctx.fillRect(lx, 3, 6, 2);
    }
    // weapon
    ctx.fillStyle = "#9fd3ff";
    ctx.fillText("GUN:" + (player.weapon === "spread" ? "SPREAD" : "RIFLE"), 110, 4);
    // score
    ctx.fillStyle = "#fff";
    ctx.textAlign = "right";
    ctx.fillText("SCORE " + String(score).padStart(6, "0"), VW - 6, 4);
    ctx.textAlign = "left";

    // progress / boss bar
    if (boss.alive && boss.active) {
      ctx.fillStyle = "#000"; ctx.fillRect(VW / 2 - 81, 22, 162, 10);
      ctx.fillStyle = "#5a1a14"; ctx.fillRect(VW / 2 - 80, 23, 160, 8);
      ctx.fillStyle = "#ff3b30"; ctx.fillRect(VW / 2 - 80, 23, 160 * (boss.hp / boss.hpMax), 8);
      ctx.fillStyle = "#fff"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
      ctx.fillText("BOSS", VW / 2, 24); ctx.textAlign = "left";
    } else {
      // level progress
      const prog = Math.min(1, player.x / (LEVEL_W - 160));
      ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(VW / 2 - 60, 24, 120, 3);
      ctx.fillStyle = "#5fe07a"; ctx.fillRect(VW / 2 - 60, 24, 120 * prog, 3);
    }
  }

  // ============================================================
  //  Overlays / flow
  // ============================================================
  function showOverlay(id, scoreId, text) {
    const el = document.getElementById(id);
    if (scoreId) document.getElementById(scoreId).textContent = text;
    el.classList.remove("hidden");
  }
  function hideOverlay(id) { document.getElementById(id).classList.add("hidden"); }

  function startGame() {
    resetGame();
    gameState = "playing";
    hideOverlay("start-screen");
    hideOverlay("gameover-screen");
    hideOverlay("win-screen");
  }

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);

  // ============================================================
  //  Main loop (fixed timestep)
  // ============================================================
  resetGame();
  gameState = "menu";
  let acc = 0, last = performance.now();
  const STEP = 1000 / 60;
  function loop(now) {
    acc += Math.min(now - last, 100);
    last = now;
    while (acc >= STEP) { update(); acc -= STEP; }
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
