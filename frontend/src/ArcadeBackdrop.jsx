import { useEffect, useRef } from 'react';

// ─── RESOLUTION-INDEPENDENT MULTI-GAME BACKDROP ─────────────────────────────
// Renders classic arcade games in a virtual 1000x1000 logical coordinate space.
// Automatically scales to any window size dynamically on every frame without
// resetting the game state. Master opacity is set extremely low (~0.04) so that
// the animations read as beautiful, subtle background watermarks, never
// competing with the foreground UI.
//
// Variants:
//   breakout  → Landing / attract screen
//   tetris    → Onboarding
//   pong      → Waiting room
//   snake     → Game window
//   invaders  → Final / results

const P = {
  purple: [123, 104, 238],
  violet: [106, 90, 205],
  pink: [255, 107, 129],
  gold: [244, 208, 63],
  mint: [126, 212, 154],
  cyan: [90, 200, 250],
  ink: [75, 69, 102],
};
const ALL = [P.pink, P.purple, P.violet, P.gold, P.mint, P.cyan];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const rand = (a, b) => a + Math.random() * (b - a);

// Opacities for background subtlety per game
const O_BREAKOUT = 0.12;
const O_TETRIS = 0.16;

// ═══════════════════════════════════════════════════════════════════════════
// BREAKOUT (Attract Screen)
// ═══════════════════════════════════════════════════════════════════════════
function runBreakout(ctx, tx, ty, ts, state, t) {
  const s = state;
  if (!s.init) {
    s.init = true;
    s.bricks = [];
    s.particles = [];
    s.ballTrail = [];
    const cols = 12, rows = 5, pad = 8;
    const mx = 60;
    const bw = (1000 - mx * 2 - pad * (cols - 1)) / cols;
    const bh = 22;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        s.bricks.push({
          x: mx + c * (bw + pad),
          y: 120 + r * (bh + pad),
          w: bw,
          h: bh,
          color: ALL[(r + c) % ALL.length],
          alive: true,
          respawnAt: 0
        });
    s.ball = { x: 500, y: 600, vx: 3.5, vy: -5.0 };
    s.paddle = { x: 425, w: 150 };
  }
  const b = s.ball, pd = s.paddle;

  // Paddle AI: Tracks the ball but oscillates slightly left/right over time to ensure off-center hits
  const targetX = b.x - pd.w / 2 + Math.sin(t * 0.04) * 45;
  pd.x += (targetX - pd.x) * 0.15;
  pd.x = Math.max(20, Math.min(1000 - pd.w - 20, pd.x));

  // Ball physics
  b.x += b.vx; b.y += b.vy;
  if (b.x < 15) { b.x = 15; b.vx = Math.abs(b.vx); }
  if (b.x > 985) { b.x = 985; b.vx = -Math.abs(b.vx); }
  if (b.y < 15) { b.y = 15; b.vy = Math.abs(b.vy); }

  const py = 880;
  // Paddle bounce
  if (b.vy > 0 && b.y >= py - 5 && b.y <= py + 20 && b.x >= pd.x - 8 && b.x <= pd.x + pd.w + 8) {
    b.vy = -Math.abs(b.vy);
    // Determine angle based on where ball hits paddle, plus a tiny random nudge
    const hitOffset = b.x - (pd.x + pd.w / 2);
    b.vx = hitOffset * 0.08 + rand(-0.8, 0.8);
    
    // Non-physical deflection: Prevent vertical traps by enforcing minimum horizontal speed
    if (Math.abs(b.vx) < 1.8) {
      b.vx = b.vx < 0 ? -1.8 : 1.8;
    }
    
    const speed = Math.hypot(b.vx, b.vy);
    const targetSpeed = 6.2; // Constant physics speed
    b.vx = (b.vx / speed) * targetSpeed;
    b.vy = (b.vy / speed) * targetSpeed;
  }

  // Safety net
  if (b.y > 940) { b.vy = -Math.abs(b.vy); b.y = py - 10; }

  s.ballTrail.push({ x: b.x, y: b.y });
  if (s.ballTrail.length > 10) s.ballTrail.shift();

  // Brick hit
  for (const br of s.bricks) {
    if (!br.alive) continue;
    if (b.x > br.x - 4 && b.x < br.x + br.w + 4 && b.y > br.y - 4 && b.y < br.y + br.h + 4) {
      br.alive = false;
      br.respawnAt = t + 480; // Respawn brick in ~8 seconds
      
      // Deflect the ball with a minor random angle nudge to keep trajectories chaotic
      b.vy = -b.vy;
      b.vx += rand(-0.4, 0.4);
      
      for (let i = 0; i < 6; i++) {
        s.particles.push({
          x: br.x + br.w / 2,
          y: br.y + br.h / 2,
          vx: rand(-3, 3),
          vy: rand(-4, 1),
          life: 30,
          color: br.color
        });
      }
      break;
    }
  }

  // Respawn brick loop
  for (const br of s.bricks) {
    if (!br.alive && br.respawnAt > 0 && t >= br.respawnAt) {
      br.alive = true;
      br.respawnAt = 0;
    }
  }

  // Draw scaled entities
  for (const br of s.bricks) {
    if (!br.alive) continue;
    ctx.fillStyle = rgba(br.color, O_BREAKOUT);
    ctx.beginPath();
    ctx.roundRect(tx(br.x), ty(br.y), tx(br.x + br.w) - tx(br.x), ty(br.y + br.h) - ty(br.y), ts(5));
    ctx.fill();
  }

  // Paddle
  ctx.fillStyle = rgba(P.purple, O_BREAKOUT + 0.05);
  ctx.beginPath();
  ctx.roundRect(tx(pd.x), ty(py), tx(pd.x + pd.w) - tx(pd.x), ty(py + 15) - ty(py), ts(6));
  ctx.fill();

  // Trail
  for (let i = 0; i < s.ballTrail.length; i++) {
    ctx.fillStyle = rgba(P.pink, (i / s.ballTrail.length) * O_BREAKOUT * 0.4);
    ctx.beginPath();
    ctx.arc(tx(s.ballTrail[i].x), ty(s.ballTrail[i].y), ts(5) * (i / s.ballTrail.length), 0, Math.PI * 2);
    ctx.fill();
  }

  // Ball
  ctx.fillStyle = rgba(P.pink, O_BREAKOUT + 0.08);
  ctx.beginPath();
  ctx.arc(tx(b.x), ty(b.y), ts(7), 0, Math.PI * 2);
  ctx.fill();

  // Particles
  for (let i = s.particles.length - 1; i >= 0; i--) {
    const p = s.particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
    ctx.fillStyle = rgba(p.color, (p.life / 30) * O_BREAKOUT);
    ctx.fillRect(tx(p.x) - ts(2), ty(p.y) - ts(2), ts(4), ts(4));
    if (p.life <= 0) s.particles.splice(i, 1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TETRIS (Onboarding — Dual-Board Left & Right layout)
// ═══════════════════════════════════════════════════════════════════════════
function runTetris(ctx, tx, ty, ts, state, _t) {
  const s = state;
  const COLS = 10, ROWS = 20;
  const SZ = 22;
  const oy = 250;
  const oxLeft = 50;
  const oxRight = 1000 - 50 - COLS * SZ;

  const SHAPES = [
    [[1,1,1,1]],
    [[1,1],[1,1]],
    [[0,1,0],[1,1,1]],
    [[1,0],[1,0],[1,1]],
    [[0,1],[0,1],[1,1]],
    [[1,1,0],[0,1,1]],
    [[0,1,1],[1,1,0]],
  ];

  const initBoard = (boardState) => {
    boardState.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    boardState.piece = null;
    boardState.particles = [];
    boardState.dropTimer = 0;
  };

  if (!s.init) {
    s.init = true;
    s.left = {};
    s.right = {};
    initBoard(s.left);
    initBoard(s.right);
  }

  const updateBoard = (bState, ox) => {
    if (!bState.piece) {
      const sh = SHAPES[(Math.random() * SHAPES.length) | 0];
      bState.piece = { shape: sh, x: ((COLS - sh[0].length) / 2) | 0, y: 0, color: ALL[(Math.random() * ALL.length) | 0] };
    }
    bState.dropTimer++;
    if (bState.dropTimer > 8) {
      bState.dropTimer = 0;
      const canDrop = bState.piece.shape.every((row, r) => row.every((v, c) => {
        if (!v) return true;
        const nr = bState.piece.y + r + 1, nc = bState.piece.x + c;
        return nr < ROWS && (!bState.grid[nr] || !bState.grid[nr][nc]);
      }));
      if (canDrop) {
        bState.piece.y++;
      } else {
        bState.piece.shape.forEach((row, r) => row.forEach((v, c) => {
          if (v) {
            const gr = bState.piece.y + r, gc = bState.piece.x + c;
            if (gr >= 0 && gr < ROWS && gc >= 0 && gc < COLS) bState.grid[gr][gc] = bState.piece.color;
          }
        }));
        for (let r = ROWS - 1; r >= 0; r--) {
          if (bState.grid[r].every(c => c !== null)) {
            for (let c = 0; c < COLS; c++) {
              bState.particles.push({
                x: ox + c * SZ + SZ / 2,
                y: oy + r * SZ + SZ / 2,
                vx: rand(-4, 4),
                vy: rand(-5, 1),
                life: 35,
                color: bState.grid[r][c] || P.purple
              });
            }
            bState.grid.splice(r, 1);
            bState.grid.unshift(Array(COLS).fill(null));
            r++;
          }
        }
        if (bState.grid[1] && bState.grid[1].some(c => c !== null) && bState.grid[0].some(c => c !== null)) {
          bState.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        }
        bState.piece = null;
      }
    }
  };

  const drawBoard = (bState, ox) => {
    ctx.strokeStyle = rgba(P.purple, 0.025);
    ctx.lineWidth = ts(1);
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(tx(ox), ty(oy + r * SZ));
      ctx.lineTo(tx(ox + COLS * SZ), ty(oy + r * SZ));
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(tx(ox + c * SZ), ty(oy));
      ctx.lineTo(tx(ox + c * SZ), ty(oy + ROWS * SZ));
      ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cl = bState.grid[r][c];
        if (cl) {
          ctx.fillStyle = rgba(cl, O_TETRIS);
          ctx.beginPath();
          ctx.roundRect(tx(ox + c * SZ + 1), ty(oy + r * SZ + 1), ts(SZ - 2), ts(SZ - 2), ts(2));
          ctx.fill();
        }
      }
    }

    if (bState.piece) {
      bState.piece.shape.forEach((row, r) => row.forEach((v, c) => {
        if (v) {
          ctx.fillStyle = rgba(bState.piece.color, O_TETRIS + 0.05);
          ctx.beginPath();
          ctx.roundRect(tx(ox + (bState.piece.x + c) * SZ + 1), ty(oy + (bState.piece.y + r) * SZ + 1), ts(SZ - 2), ts(SZ - 2), ts(2));
          ctx.fill();
        }
      }));
    }

    // Particles
    for (let i = bState.particles.length - 1; i >= 0; i--) {
      const p = bState.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
      ctx.fillStyle = rgba(p.color, (p.life / 35) * O_TETRIS);
      ctx.fillRect(tx(p.x) - ts(3), ty(p.y) - ts(3), ts(6), ts(6));
      if (p.life <= 0) bState.particles.splice(i, 1);
    }
  };

  updateBoard(s.left, oxLeft);
  updateBoard(s.right, oxRight);

  drawBoard(s.left, oxLeft);
  drawBoard(s.right, oxRight);
}

// ═══════════════════════════════════════════════════════════════════════════
// PONG (Waiting Room — Dual Side-by-Side Boards)
// ═══════════════════════════════════════════════════════════════════════════
const initPongBoard = (left, right) => ({
  ball: { x: (left + right) / 2, y: 500, vx: (Math.random() > 0.5 ? 5.0 : -5.0), vy: rand(-2, 2) },
  p1: 500,
  p2: 500,
  s1: 0,
  s2: 0,
  particles: [],
  trail: []
});

const updateAndDrawPong = (ctx, tx, ty, ts, bState, left, right, O, _t) => {
  const b = bState.ball, pw = 12, ph = 100;
  
  // AI Tracking
  bState.p1 += (b.y - bState.p1) * 0.08;
  bState.p2 += (b.y - bState.p2) * 0.09;
  bState.p1 = Math.max(ph / 2, Math.min(1000 - ph / 2, bState.p1));
  bState.p2 = Math.max(ph / 2, Math.min(1000 - ph / 2, bState.p2));

  // Ball Physics
  b.x += b.vx; b.y += b.vy;
  if (b.y < 20) { b.y = 20; b.vy = Math.abs(b.vy); }
  if (b.y > 980) { b.y = 980; b.vy = -Math.abs(b.vy); }

  // Paddle hit tests
  const lpX = left + 15;
  if (b.vx < 0 && b.x < lpX + pw && b.x > lpX && b.y > bState.p1 - ph / 2 && b.y < bState.p1 + ph / 2) {
    b.vx = Math.abs(b.vx) * 1.02; b.vy += rand(-1.5, 1.5);
    for (let i = 0; i < 5; i++) bState.particles.push({ x: lpX + pw, y: b.y, vx: rand(2, 5), vy: rand(-3, 3), life: 25, color: P.purple });
  }
  const rpX = right - 15 - pw;
  if (b.vx > 0 && b.x > rpX && b.x < rpX + pw && b.y > bState.p2 - ph / 2 && b.y < bState.p2 + ph / 2) {
    b.vx = -Math.abs(b.vx) * 1.02; b.vy += rand(-1.5, 1.5);
    for (let i = 0; i < 5; i++) bState.particles.push({ x: rpX, y: b.y, vx: rand(-5, -2), vy: rand(-3, 3), life: 25, color: P.pink });
  }

  // Scoring
  if (b.x < left || b.x > right) {
    if (b.x < left) bState.s2++; else bState.s1++;
    b.x = (left + right) / 2; b.y = 500;
    b.vx = (b.vx < 0 ? 5.0 : -5.0); b.vy = rand(-2, 2);
  }

  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 11) { b.vx *= 11 / sp; b.vy *= 11 / sp; }

  bState.trail.push({ x: b.x, y: b.y });
  if (bState.trail.length > 8) bState.trail.shift();

  // Draw Center divider
  const midX = (left + right) / 2;
  for (let y = 0; y < 1000; y += 50) {
    ctx.fillStyle = rgba(P.purple, 0.025);
    ctx.fillRect(tx(midX) - ts(1.5), ty(y), ts(3), ty(25) - ty(0));
  }

  // Paddles
  ctx.fillStyle = rgba(P.purple, O);
  ctx.beginPath(); ctx.roundRect(tx(lpX), ty(bState.p1 - ph / 2), ts(pw), ty(ph) - ty(0), ts(3)); ctx.fill();
  ctx.fillStyle = rgba(P.pink, O);
  ctx.beginPath(); ctx.roundRect(tx(rpX), ty(bState.p2 - ph / 2), ts(pw), ty(ph) - ty(0), ts(3)); ctx.fill();

  // Ball Trail
  for (let i = 0; i < bState.trail.length; i++) {
    ctx.fillStyle = rgba(P.gold, (i / bState.trail.length) * O * 0.4);
    ctx.beginPath(); ctx.arc(tx(bState.trail[i].x), ty(bState.trail[i].y), ts(4) * (i / bState.trail.length), 0, Math.PI * 2); ctx.fill();
  }

  // Ball
  ctx.fillStyle = rgba(P.gold, O + 0.08);
  ctx.beginPath(); ctx.arc(tx(b.x), ty(b.y), ts(6), 0, Math.PI * 2); ctx.fill();

  // Score readout
  ctx.fillStyle = rgba(P.ink, 0.04);
  ctx.font = `bold ${ts(22)}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(bState.s1, tx(midX - 40), ty(200));
  ctx.fillText(bState.s2, tx(midX + 40), ty(200));

  // Particles
  for (let i = bState.particles.length - 1; i >= 0; i--) {
    const p = bState.particles[i]; p.x += p.vx; p.y += p.vy; p.life--;
    ctx.fillStyle = rgba(p.color, (p.life / 25) * O);
    ctx.fillRect(tx(p.x) - ts(2), ty(p.y) - ts(2), ts(4), ts(4));
    if (p.life <= 0) bState.particles.splice(i, 1);
  }
};

function runPong(ctx, tx, ty, ts, state, t) {
  const s = state;
  const O = 0.14; // Visible opacity for side games

  if (!s.init) {
    s.init = true;
    s.left = initPongBoard(30, 230);
    s.right = initPongBoard(770, 970);
  }

  updateAndDrawPong(ctx, tx, ty, ts, s.left, 30, 230, O, t);
  updateAndDrawPong(ctx, tx, ty, ts, s.right, 770, 970, O, t);
}

// ═══════════════════════════════════════════════════════════════════════════
// SNAKE (Game Arena)
// ═══════════════════════════════════════════════════════════════════════════
function runSnake(ctx, tx, ty, ts, state, t) {
  const s = state;
  const COLS = 32, ROWS = 24;
  const szX = 1000 / COLS, szY = 1000 / ROWS;
  if (!s.init) {
    s.init = true;
    s.body = [{ x: 16, y: 12 }];
    s.dir = { x: 1, y: 0 }; s.food = null; s.timer = 0; s.particles = [];
  }
  if (!s.food) s.food = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 };

  s.timer++;
  if (s.timer > 3) {
    s.timer = 0;
    // AI navigation to food
    const head = s.body[0];
    const dx = s.food.x - head.x, dy = s.food.y - head.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      const nd = { x: dx > 0 ? 1 : -1, y: 0 };
      if (nd.x !== -s.dir.x) s.dir = nd;
      else s.dir = { x: 0, y: dy >= 0 ? 1 : -1 };
    } else {
      const nd = { x: 0, y: dy > 0 ? 1 : -1 };
      if (nd.y !== -s.dir.y) s.dir = nd;
      else s.dir = { x: dx >= 0 ? 1 : -1, y: 0 };
    }

    const nh = { x: (head.x + s.dir.x + COLS) % COLS, y: (head.y + s.dir.y + ROWS) % ROWS };

    // Collision resets
    if (s.body.some(seg => seg.x === nh.x && seg.y === nh.y)) {
      for (const seg of s.body) {
        s.particles.push({
          x: seg.x * szX + szX / 2,
          y: seg.y * szY + szY / 2,
          vx: rand(-3, 3), vy: rand(-3, 3),
          life: 25, color: P.mint
        });
      }
      s.body = [nh]; s.dir = { x: 1, y: 0 };
    } else {
      s.body.unshift(nh);
      if (nh.x === s.food.x && nh.y === s.food.y) {
        for (let i = 0; i < 8; i++) {
          s.particles.push({
            x: s.food.x * szX + szX / 2,
            y: s.food.y * szY + szY / 2,
            vx: rand(-3, 3), vy: rand(-3, 3),
            life: 20, color: P.gold
          });
        }
        s.food = null;
      } else {
        s.body.pop();
      }
    }
  }

  // Draw snake segments
  s.body.forEach((seg, i) => {
    const a = O * (1 - i / (s.body.length + 5) * 0.5);
    ctx.fillStyle = rgba(i === 0 ? P.purple : P.mint, a);
    ctx.beginPath();
    ctx.roundRect(tx(seg.x * szX + 1), ty(seg.y * szY + 1), ts(szX - 2), ts(szY - 2), ts(4));
    ctx.fill();
  });

  // Draw Food
  if (s.food) {
    ctx.fillStyle = rgba(P.gold, O + 0.08 + Math.sin(t * 0.1) * 0.04);
    ctx.beginPath();
    ctx.arc(tx(s.food.x * szX + szX / 2), ty(s.food.y * szY + szY / 2), ts(szX * 0.38), 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles
  for (let i = s.particles.length - 1; i >= 0; i--) {
    const p = s.particles[i]; p.x += p.vx; p.y += p.vy; p.life--;
    ctx.fillStyle = rgba(p.color, (p.life / 25) * O);
    ctx.fillRect(tx(p.x) - ts(2), ty(p.y) - ts(2), ts(4), ts(4));
    if (p.life <= 0) s.particles.splice(i, 1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SPACE INVADERS (Final Page)
// ═══════════════════════════════════════════════════════════════════════════
function runInvaders(ctx, tx, ty, ts, state, t) {
  const s = state;
  const invWidth = 40, invHeight = 24;
  if (!s.init) {
    s.init = true;
    s.invaders = [];
    const cols = 8, rows = 4, gap = 70;
    const ox = (1000 - cols * gap) / 2;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        s.invaders.push({
          x: ox + c * gap + gap / 2,
          y: 100 + r * gap * 0.7,
          alive: true,
          color: ALL[(r + c) % ALL.length]
        });
    s.dir = 1; s.stepTimer = 0; s.speed = 8;
    s.ship = { x: 500 }; s.bullets = []; s.iBullets = []; s.particles = []; s.fireCd = 0;
  }

  // Step Invaders
  s.stepTimer++;
  if (s.stepTimer >= s.speed) {
    s.stepTimer = 0;
    let edgeHit = false;
    for (const inv of s.invaders) {
      if (!inv.alive) continue;
      if ((inv.x > 940 && s.dir > 0) || (inv.x < 60 && s.dir < 0)) edgeHit = true;
    }
    if (edgeHit) {
      s.dir *= -1;
      for (const inv of s.invaders) inv.y += 24;
    }
    for (const inv of s.invaders) { if (inv.alive) inv.x += s.dir * 12; }
    if (s.invaders.some(i => i.alive && i.y > 800)) { s.init = false; return; }
  }

  if (s.invaders.every(i => !i.alive)) { s.init = false; return; }

  // Ship AI Target tracking
  const alive = s.invaders.filter(i => i.alive);
  const target = alive.reduce((best, i) => i.y > best.y ? i : best, alive[0]);
  s.ship.x += (target.x - s.ship.x) * 0.08;

  // Ship firing rate
  s.fireCd--;
  if (s.fireCd <= 0) { s.bullets.push({ x: s.ship.x, y: 840 }); s.fireCd = 12; }

  // Invaders fire back
  if (t % 40 === 0 && alive.length > 0) {
    const shooter = alive[(Math.random() * alive.length) | 0];
    s.iBullets.push({ x: shooter.x, y: shooter.y + 15 });
  }

  // Bullets physics
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    s.bullets[i].y -= 12;
    if (s.bullets[i].y < -20) { s.bullets.splice(i, 1); continue; }
    for (const inv of s.invaders) {
      if (!inv.alive) continue;
      if (Math.abs(s.bullets[i].x - inv.x) < 22 && Math.abs(s.bullets[i].y - inv.y) < 16) {
        inv.alive = false; s.bullets.splice(i, 1);
        for (let j = 0; j < 6; j++) {
          s.particles.push({
            x: inv.x, y: inv.y,
            vx: rand(-3, 3), vy: rand(-3, 2),
            life: 20, color: inv.color
          });
        }
        break;
      }
    }
  }

  for (let i = s.iBullets.length - 1; i >= 0; i--) {
    s.iBullets[i].y += 7;
    if (s.iBullets[i].y > 1020) s.iBullets.splice(i, 1);
  }

  // Draw Invaders
  for (const inv of s.invaders) {
    if (!inv.alive) continue;
    ctx.fillStyle = rgba(inv.color, O);
    ctx.fillRect(tx(inv.x - invWidth / 2), ty(inv.y - invHeight / 2), ts(invWidth), ts(invHeight));
    ctx.fillRect(tx(inv.x - invWidth / 2 - 8), ty(inv.y), ts(8), ts(12));
    ctx.fillRect(tx(inv.x + invWidth / 2), ty(inv.y), ts(8), ts(12));
  }

  // Draw Hero Ship
  ctx.fillStyle = rgba(P.cyan, O + 0.05);
  ctx.beginPath();
  ctx.moveTo(tx(s.ship.x), ty(800));
  ctx.lineTo(tx(s.ship.x + 22), ty(850));
  ctx.lineTo(tx(s.ship.x - 22), ty(850));
  ctx.closePath();
  ctx.fill();

  // Draw Bullets
  for (const b of s.bullets) {
    ctx.fillStyle = rgba(P.cyan, O + 0.08);
    ctx.fillRect(tx(b.x - 2), ty(b.y - 10), ts(4), ts(16));
  }
  for (const b of s.iBullets) {
    ctx.fillStyle = rgba(P.pink, O + 0.06);
    ctx.beginPath(); ctx.arc(tx(b.x), ty(b.y), ts(5), 0, Math.PI * 2); ctx.fill();
  }

  // Particles
  for (let i = s.particles.length - 1; i >= 0; i--) {
    const p = s.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--;
    ctx.fillStyle = rgba(p.color, (p.life / 20) * O);
    ctx.fillRect(tx(p.x) - ts(2), ty(p.y) - ts(2), ts(4), ts(4));
    if (p.life <= 0) s.particles.splice(i, 1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT (Backdrop System)
// ═══════════════════════════════════════════════════════════════════════════
const RUNNERS = { breakout: runBreakout, tetris: runTetris, pong: runPong, snake: runSnake, invaders: runInvaders };

export default function ArcadeBackdrop({ variant = 'breakout' }) {
  const ref = useRef(null);
  const stateRef = useRef({});

  // Reset internal states only when switching game modes
  useEffect(() => { stateRef.current = {}; }, [variant]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    // Low-resolution internal buffer — upscaled with smoothing OFF for a crisp,
    // chunky pixel-art look (our "old-school arcade" treatment).
    const PIX = 3.2; // scale-down factor
    const low = document.createElement('canvas');
    const lctx = low.getContext('2d');
    let W = window.innerWidth;
    let H = window.innerHeight;
    let LW = Math.max(1, Math.round(W / PIX));
    let LH = Math.max(1, Math.round(H / PIX));

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      LW = low.width = Math.max(1, Math.round(W / PIX));
      LH = low.height = Math.max(1, Math.round(H / PIX));
    };
    resize();
    window.addEventListener('resize', resize);

    // Helpers to transform virtual 1000x1000 coordinates to low-res pixels
    const tx = (x) => (x / 1000) * LW;
    const ty = (y) => (y / 1000) * LH;
    const ts = (size) => (size / 1000) * Math.min(LW, LH);

    let t = 0;
    const frame = () => {
      t++;
      lctx.fillStyle = 'rgba(238,232,252,0.98)';
      lctx.fillRect(0, 0, LW, LH);

      const run = RUNNERS[variant] || RUNNERS.breakout;
      run(lctx, tx, ty, ts, stateRef.current, t);

      // upscale the low-res frame onto the visible canvas, no smoothing = pixelated
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(low, 0, 0, W, H);

      raf = requestAnimationFrame(frame);
    };

    let raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [variant]);

  return (
    <div className="arcade-bg">
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
      <span className="bg-scan" />
      <div className="bg-vignette" />
    </div>
  );
}