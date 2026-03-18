"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const W = 600, H = 240;
const GY = 175;
const GRAVITY = 0.55;
const JUMP_VEL = -10.5;
const DOUBLE_JUMP_VEL = -9;
const P_SIZE = 28;
const P_DUCK_H = 16;
const PX = 60;

const MILESTONE_LABELS = [
  [10, "Nice!"],    [25, "Great!"],  [50, "Amazing!"],
  [75, "On Fire!"], [100, "Legendary!"], [150, "Unstoppable!"],
  [200, "GOD MODE!"],
];

export default function WaitingLobbyGame() {
  const canvasRef = useRef(null);
  const sr = useRef(null);
  const raf = useRef(null);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const keysRef = useRef({ duck: false });

  const init = useCallback(() => {
    const saved = typeof window !== "undefined" ? parseInt(localStorage.getItem("retro_game_hi") || "0", 10) : 0;
    setHighScore(saved);
    return {
      py: GY - P_SIZE, vy: 0, jumping: false, jumps: 0,
      ducking: false, duckFrame: 0,
      obstacles: [], flyingObs: [], coinItems: [],
      particles: [], popups: [],
      clouds: Array.from({ length: 4 }, (_, i) => ({
        x: 120 + i * 160, y: 20 + Math.random() * 45, w: 35 + Math.random() * 35,
      })),
      stars: Array.from({ length: 8 }, () => ({
        x: Math.random() * W, y: 8 + Math.random() * 70,
        r: 1 + Math.random() * 1.5, tw: Math.random() * Math.PI * 2,
      })),
      fc: 0, score: 0, coins: 0, combo: 0, comboTimer: 0,
      speed: 3.5, gameOver: false, nextOb: 90, nextFlyer: 250, nextCoin: 140,
      shakeX: 0, shakeY: 0, shakeT: 0,
      nightFactor: 0, milestonesHit: new Set(),
      invincible: 0, magnetTimer: 0,
      trailParts: [],
    };
  }, []);

  const reset = useCallback(() => {
    sr.current = init();
    setScore(0); setCoins(0); setCombo(0);
    setGameOver(false); setStarted(true);
  }, [init]);

  const jump = useCallback(() => {
    if (!started) { reset(); return; }
    const s = sr.current;
    if (!s) return;
    if (s.gameOver) { reset(); return; }
    if (s.jumps < 2) {
      s.vy = s.jumps === 0 ? JUMP_VEL : DOUBLE_JUMP_VEL;
      s.jumping = true;
      s.jumps++;
      spawnParticles(s, PX + P_SIZE / 2, s.py + P_SIZE, s.jumps === 2 ? "#a78bfa" : "#818cf8", 6);
      if (s.jumps === 2) {
        spawnParticles(s, PX + P_SIZE / 2, s.py + P_SIZE / 2, "#fbbf24", 4);
      }
    }
  }, [started, reset]);

  function spawnParticles(s, x, y, color, count) {
    for (let i = 0; i < count; i++) {
      s.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3 - 1,
        life: 25 + Math.random() * 15,
        maxLife: 40, r: 2 + Math.random() * 2, color,
      });
    }
  }

  function spawnPopup(s, text, color) {
    s.popups.push({ text, color, x: W / 2, y: 50, life: 70, maxLife: 70 });
  }

  useEffect(() => { sr.current = init(); }, [init]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function rRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function drawPlayer(s) {
      const ducking = s.ducking && !s.jumping;
      const ph = ducking ? P_DUCK_H : P_SIZE;
      const py = ducking ? GY - P_DUCK_H : s.py;
      const pw = ducking ? P_SIZE + 6 : P_SIZE;
      const bounce = Math.sin(s.fc * 0.15) * (s.jumping ? 0 : 1.5);

      s.trailParts.forEach((t) => {
        const a = t.life / t.maxLife * 0.3;
        ctx.fillStyle = `rgba(129,140,248,${a})`;
        rRect(t.x, t.y, t.w, t.h, 4); ctx.fill();
      });

      ctx.save();
      if (s.invincible > 0) {
        ctx.shadowColor = "rgba(251,191,36,0.6)";
        ctx.shadowBlur = 18;
      } else {
        ctx.shadowColor = "rgba(99,102,241,0.3)";
        ctx.shadowBlur = 10;
      }
      rRect(PX, py + bounce, pw, ph, ducking ? 4 : 6);
      const grad = ctx.createLinearGradient(PX, py, PX, py + ph);
      if (s.invincible > 0) {
        grad.addColorStop(0, "#fbbf24"); grad.addColorStop(1, "#f59e0b");
      } else if (s.jumps === 2) {
        grad.addColorStop(0, "#a78bfa"); grad.addColorStop(1, "#7c3aed");
      } else {
        grad.addColorStop(0, "#818cf8"); grad.addColorStop(1, "#6366f1");
      }
      ctx.fillStyle = grad; ctx.fill();
      ctx.shadowBlur = 0;

      if (!ducking) {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(PX + 18, py + bounce + 10, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1e1b4b";
        ctx.beginPath(); ctx.arc(PX + 19, py + bounce + 10, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.moveTo(PX + 6, py + bounce + 2);
        ctx.lineTo(PX + 10, py + bounce - 6);
        ctx.lineTo(PX + 14, py + bounce + 2);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(PX + pw - 8, py + bounce + 6, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1e1b4b";
        ctx.beginPath(); ctx.arc(PX + pw - 7, py + bounce + 6, 1.2, 0, Math.PI * 2); ctx.fill();
      }

      if (s.jumping && s.vy > 0) {
        ctx.strokeStyle = "rgba(99,102,241,0.2)";
        ctx.lineWidth = 1.5;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.arc(PX + pw / 2, py + ph + i * 5, 2 + i * 2, 0, Math.PI);
          ctx.stroke();
        }
      }

      if (s.jumps === 2 && s.jumping) {
        const wingSpread = Math.sin(s.fc * 0.3) * 6;
        ctx.strokeStyle = "rgba(167,139,250,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PX + 2, py + bounce + ph / 2);
        ctx.quadraticCurveTo(PX - 10, py + bounce + ph / 2 - 8 - wingSpread, PX - 6, py + bounce - 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(PX + pw - 2, py + bounce + ph / 2);
        ctx.quadraticCurveTo(PX + pw + 10, py + bounce + ph / 2 - 8 - wingSpread, PX + pw + 6, py + bounce - 4);
        ctx.stroke();
      }

      if (s.magnetTimer > 0) {
        ctx.strokeStyle = `rgba(56,189,248,${0.3 + Math.sin(s.fc * 0.1) * 0.15})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(PX + pw / 2, py + bounce + ph / 2, P_SIZE + 8 + Math.sin(s.fc * 0.08) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawGroundObstacle(ob) {
      ctx.save();
      ctx.shadowColor = "rgba(239,68,68,0.2)";
      ctx.shadowBlur = 6;
      if (ob.type === 0) {
        rRect(ob.x, GY - ob.h, ob.w, ob.h, 4);
        const g = ctx.createLinearGradient(ob.x, GY - ob.h, ob.x, GY);
        g.addColorStop(0, "#f87171"); g.addColorStop(1, "#ef4444");
        ctx.fillStyle = g; ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(ob.x + 3, GY - ob.h + 3, ob.w - 6, 3);
        if (ob.h > 30) {
          ctx.fillStyle = "rgba(0,0,0,0.1)";
          ctx.fillRect(ob.x + 3, GY - ob.h / 2, ob.w - 6, 2);
        }
      } else if (ob.type === 1) {
        const top = GY - ob.h;
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.moveTo(ob.x, top + ob.h); ctx.lineTo(ob.x + ob.w / 2, top); ctx.lineTo(ob.x + ob.w, top + ob.h);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.beginPath();
        ctx.moveTo(ob.x + ob.w * 0.3, top + ob.h * 0.5);
        ctx.lineTo(ob.x + ob.w / 2, top + 4);
        ctx.lineTo(ob.x + ob.w * 0.55, top + ob.h * 0.5);
        ctx.closePath(); ctx.fill();
      } else {
        rRect(ob.x, GY - ob.h, ob.w, ob.h, 3);
        const g = ctx.createLinearGradient(ob.x, GY - ob.h, ob.x + ob.w, GY);
        g.addColorStop(0, "#fb923c"); g.addColorStop(1, "#ea580c");
        ctx.fillStyle = g; ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        for (let i = 0; i < ob.h - 8; i += 10) {
          ctx.fillRect(ob.x + 3, GY - ob.h + 4 + i, ob.w - 6, 3);
        }
      }
      ctx.restore();
    }

    function drawFlyer(ob) {
      ctx.save();
      const wingY = Math.sin(ob.wingPhase + sr.current.fc * 0.15) * 5;
      ctx.shadowColor = "rgba(168,85,247,0.3)"; ctx.shadowBlur = 8;

      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      ctx.ellipse(ob.x + ob.w / 2, ob.y + ob.h / 2, ob.w / 2, ob.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#a78bfa";
      ctx.beginPath();
      ctx.moveTo(ob.x + 4, ob.y + ob.h / 2);
      ctx.quadraticCurveTo(ob.x - 6, ob.y - 6 + wingY, ob.x - 12, ob.y + wingY);
      ctx.quadraticCurveTo(ob.x - 4, ob.y + ob.h / 2 + 2, ob.x + 4, ob.y + ob.h / 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ob.x + ob.w - 4, ob.y + ob.h / 2);
      ctx.quadraticCurveTo(ob.x + ob.w + 6, ob.y - 6 + wingY, ob.x + ob.w + 12, ob.y + wingY);
      ctx.quadraticCurveTo(ob.x + ob.w + 4, ob.y + ob.h / 2 + 2, ob.x + ob.w - 4, ob.y + ob.h / 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(ob.x + ob.w * 0.65, ob.y + ob.h * 0.4, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1e1b4b";
      ctx.beginPath(); ctx.arc(ob.x + ob.w * 0.68, ob.y + ob.h * 0.4, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawCoin(c) {
      ctx.save();
      const bob = Math.sin(c.phase + sr.current.fc * 0.06) * 4;
      const shimmer = 0.7 + Math.sin(sr.current.fc * 0.1 + c.phase) * 0.3;

      if (c.isPower) {
        ctx.shadowColor = "rgba(56,189,248,0.5)"; ctx.shadowBlur = 12;
        ctx.fillStyle = `rgba(56,189,248,${shimmer})`;
        ctx.beginPath();
        const cx = c.x + 7, cy = c.y + bob + 7;
        for (let i = 0; i < 5; i++) {
          const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? 8 : 4;
          ctx[i === 0 ? "moveTo" : "lineTo"](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(cx - 1, cy - 1, 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.shadowColor = "rgba(251,191,36,0.4)"; ctx.shadowBlur = 10;
        const scaleX = 0.6 + Math.abs(Math.sin(sr.current.fc * 0.05 + c.phase)) * 0.4;
        ctx.translate(c.x + 7, c.y + bob + 7);
        ctx.scale(scaleX, 1);
        ctx.fillStyle = `rgba(251,191,36,${shimmer})`;
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath(); ctx.arc(-1, -1, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    function drawScene(s) {
      ctx.save();
      if (s.shakeT > 0) ctx.translate(s.shakeX, s.shakeY);

      ctx.clearRect(-10, -10, W + 20, H + 20);

      const nf = Math.min(s.nightFactor, 1);
      const skyGrad = ctx.createLinearGradient(0, 0, 0, GY);
      const r1 = Math.round(224 - nf * 120), g1 = Math.round(231 - nf * 130), b1 = Math.round(255 - nf * 140);
      const r2 = Math.round(240 - nf * 100), g2 = Math.round(253 - nf * 120), b2 = Math.round(244 - nf * 80);
      skyGrad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
      skyGrad.addColorStop(1, `rgb(${r2},${g2},${b2})`);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-10, -10, W + 20, GY + 10);

      s.stars.forEach((st) => {
        const minAlpha = nf > 0.3 ? 0.4 : 0.15;
        const a = minAlpha + Math.sin(st.tw + s.fc * 0.03) * 0.35;
        ctx.fillStyle = `rgba(${nf > 0.5 ? "255,255,200" : "139,92,246"},${a})`;
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r * (1 + nf * 0.5), 0, Math.PI * 2); ctx.fill();
      });

      if (nf > 0.3) {
        ctx.fillStyle = `rgba(250,250,210,${(nf - 0.3) * 0.4})`;
        ctx.beginPath(); ctx.arc(W - 60, 35, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgb(${r1},${g1},${b1})`;
        ctx.beginPath(); ctx.arc(W - 54, 30, 14, 0, Math.PI * 2); ctx.fill();
      }

      s.clouds.forEach((c) => {
        const a = 0.7 - nf * 0.3;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w / 2, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(c.x - c.w * 0.25, c.y + 4, c.w * 0.3, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(c.x + c.w * 0.25, c.y + 3, c.w * 0.22, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      });

      const groundBright = Math.round(209 - nf * 80);
      ctx.fillStyle = `rgb(${groundBright},${groundBright + 4},${groundBright + 10})`;
      ctx.fillRect(-10, GY, W + 20, 2);
      for (let i = 0; i < W + 20; i += 18) {
        const off = (s.fc * s.speed) % 18;
        ctx.fillStyle = `rgba(156,163,175,${0.3 + nf * 0.15})`;
        ctx.fillRect(i - off - 10, GY + 5, 7, 2);
      }
      const floorBright = Math.round(249 - nf * 80);
      ctx.fillStyle = `rgb(${floorBright},${floorBright},${floorBright})`;
      ctx.fillRect(-10, GY + 2, W + 20, H - GY + 10);

      if (s.speed > 6) {
        const intensity = Math.min((s.speed - 6) / 4, 1);
        for (let i = 0; i < 3; i++) {
          const lx = ((s.fc * s.speed * 2 + i * 200) % (W + 100)) - 50;
          ctx.strokeStyle = `rgba(99,102,241,${0.06 * intensity})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(lx, GY + 8); ctx.lineTo(lx + 30 + s.speed * 3, GY + 8); ctx.stroke();
        }
      }

      s.coinItems.forEach((c) => drawCoin(c));
      s.obstacles.forEach((ob) => drawGroundObstacle(ob));
      s.flyingObs.forEach((ob) => drawFlyer(ob));
      drawPlayer(s);

      s.particles.forEach((p) => {
        const a = p.life / p.maxLife;
        ctx.fillStyle = typeof p.color === "string"
          ? p.color.replace(")", `,${a})`).replace("rgb", "rgba")
          : `rgba(${p.color},${a})`;
        if (p.color.startsWith && p.color.startsWith("#")) {
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });

      s.popups.forEach((p) => {
        const progress = 1 - p.life / p.maxLife;
        const a = progress < 0.2 ? progress / 0.2 : progress > 0.7 ? (1 - progress) / 0.3 : 1;
        const yOff = -progress * 30;
        const scale = 0.8 + Math.sin(progress * Math.PI) * 0.3;
        ctx.save();
        ctx.translate(p.x, p.y + yOff);
        ctx.scale(scale, scale);
        ctx.globalAlpha = a;
        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.strokeText(p.text, 0, 0);
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
        ctx.globalAlpha = 1;
      });

      if (s.combo > 1 && s.comboTimer > 0) {
        const a = Math.min(s.comboTimer / 30, 1);
        ctx.globalAlpha = a;
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillStyle = s.combo >= 5 ? "#ef4444" : s.combo >= 3 ? "#f59e0b" : "#6366f1";
        ctx.fillText(`${s.combo}x COMBO`, W - 12, 20);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    function tick() {
      const s = sr.current;
      if (!s || s.gameOver) { if (s) drawScene(s); return; }

      s.fc++;
      s.speed = 3.5 + Math.min(s.score / 8, 5) * 0.5;
      s.nightFactor = Math.sin(s.fc * 0.0008) * 0.5 + 0.5;

      if (s.invincible > 0) s.invincible--;
      if (s.magnetTimer > 0) s.magnetTimer--;
      if (s.comboTimer > 0) { s.comboTimer--; if (s.comboTimer <= 0) { s.combo = 0; setCombo(0); } }

      const ducking = keysRef.current.duck && !s.jumping;
      s.ducking = ducking;
      if (ducking) s.duckFrame = Math.min(s.duckFrame + 1, 5);
      else s.duckFrame = Math.max(s.duckFrame - 1, 0);

      s.vy += GRAVITY;
      s.py += s.vy;
      if (s.py >= GY - P_SIZE) {
        s.py = GY - P_SIZE;
        s.vy = 0; s.jumping = false; s.jumps = 0;
      }

      if (s.fc % 3 === 0 && (s.jumping || s.speed > 5)) {
        const ph = ducking ? P_DUCK_H : P_SIZE;
        s.trailParts.push({
          x: PX, y: ducking ? GY - P_DUCK_H : s.py,
          w: ducking ? P_SIZE + 6 : P_SIZE, h: ph,
          life: 8, maxLife: 8,
        });
      }
      s.trailParts = s.trailParts.filter((t) => { t.life--; return t.life > 0; });

      s.clouds.forEach((c) => {
        c.x -= s.speed * 0.15;
        if (c.x + c.w < -20) { c.x = W + c.w + 20; c.y = 20 + Math.random() * 45; c.w = 35 + Math.random() * 35; }
      });

      s.nextOb--;
      if (s.nextOb <= 0) {
        const diff = Math.min(s.score / 20, 1);
        const r = Math.random();
        const type = r < 0.45 ? 0 : r < 0.75 ? 1 : 2;
        const baseH = type === 2 ? 35 : type === 1 ? 28 : 22;
        const extraH = type === 2 ? 20 : type === 1 ? 14 : 20;
        s.obstacles.push({
          x: W + 10,
          w: type === 2 ? 22 : type === 0 ? 16 + Math.random() * 14 : 24 + Math.random() * 10,
          h: baseH + Math.random() * extraH * (0.5 + diff * 0.5),
          type, scored: false,
        });
        const gapMin = Math.max(55, 90 - diff * 35);
        const gapMax = Math.max(100, 180 - diff * 70);
        s.nextOb = gapMin + Math.random() * (gapMax - gapMin);
      }

      s.nextFlyer--;
      if (s.nextFlyer <= 0 && s.score >= 8) {
        const flyH = 40 + Math.random() * 50;
        s.flyingObs.push({
          x: W + 10, y: GY - flyH - 10,
          w: 22, h: 16,
          wingPhase: Math.random() * Math.PI * 2,
          scored: false, speed: s.speed * (0.8 + Math.random() * 0.4),
        });
        const freq = Math.max(120, 300 - s.score * 1.5);
        s.nextFlyer = freq + Math.random() * 80;
      }

      s.nextCoin--;
      if (s.nextCoin <= 0) {
        const isPower = Math.random() < 0.12 && s.score >= 15;
        const coinY = GY - 35 - Math.random() * 65;
        s.coinItems.push({
          x: W + 10, y: coinY, phase: Math.random() * Math.PI * 2,
          collected: false, isPower,
          powerType: isPower ? (Math.random() < 0.5 ? "shield" : "magnet") : null,
        });
        s.nextCoin = 60 + Math.random() * 80;
      }

      s.obstacles.forEach((ob) => {
        ob.x -= s.speed;
        if (!ob.scored && ob.x + ob.w < PX) {
          ob.scored = true;
          s.combo++; s.comboTimer = 90;
          const bonus = Math.min(s.combo, 5);
          s.score += bonus;
          setScore(s.score); setCombo(s.combo);
        }
      });
      s.obstacles = s.obstacles.filter((ob) => ob.x + ob.w > -20);

      s.flyingObs.forEach((ob) => {
        ob.x -= ob.speed;
        if (!ob.scored && ob.x + ob.w < PX) {
          ob.scored = true;
          s.combo++; s.comboTimer = 90;
          s.score += Math.min(s.combo, 5) + 1;
          setScore(s.score); setCombo(s.combo);
        }
      });
      s.flyingObs = s.flyingObs.filter((ob) => ob.x + ob.w > -20);

      s.coinItems.forEach((c) => {
        c.x -= s.speed;
        if (!c.collected) {
          const pCx = PX + P_SIZE / 2, pCy = s.py + P_SIZE / 2;
          const cCx = c.x + 7, cCy = c.y + 7;
          let collectDist = 18;
          if (s.magnetTimer > 0) {
            collectDist = 80;
            const dx = pCx - cCx, dy = pCy - cCy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120 && dist > 1) {
              c.x += (dx / dist) * 3;
              c.y += (dy / dist) * 3;
            }
          }
          const dx = pCx - cCx, dy = pCy - cCy;
          if (Math.sqrt(dx * dx + dy * dy) < collectDist) {
            c.collected = true;
            if (c.isPower) {
              if (c.powerType === "shield") {
                s.invincible = 180;
                spawnPopup(s, "SHIELD!", "#fbbf24");
              } else {
                s.magnetTimer = 300;
                spawnPopup(s, "MAGNET!", "#38bdf8");
              }
              spawnParticles(s, cCx, cCy, "#38bdf8", 10);
            } else {
              s.coins++;
              setCoins(s.coins);
              spawnParticles(s, cCx, cCy, "#fbbf24", 6);
              if (s.coins % 10 === 0) {
                s.score += 5;
                setScore(s.score);
                spawnPopup(s, "+5 BONUS!", "#10b981");
              }
            }
          }
        }
      });
      s.coinItems = s.coinItems.filter((c) => c.x > -20 && !c.collected);

      s.particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life--; });
      s.particles = s.particles.filter((p) => p.life > 0);

      s.popups.forEach((p) => p.life--);
      s.popups = s.popups.filter((p) => p.life > 0);

      if (s.shakeT > 0) {
        s.shakeT--;
        s.shakeX = (Math.random() - 0.5) * s.shakeT * 0.8;
        s.shakeY = (Math.random() - 0.5) * s.shakeT * 0.5;
      }

      for (const [threshold, label] of MILESTONE_LABELS) {
        if (s.score >= threshold && !s.milestonesHit.has(threshold)) {
          s.milestonesHit.add(threshold);
          const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#dc2626"];
          spawnPopup(s, label, colors[Math.min(MILESTONE_LABELS.findIndex(([t]) => t === threshold), colors.length - 1)]);
          spawnParticles(s, W / 2, 60, "#fbbf24", 12);
        }
      }

      if (s.invincible <= 0) {
        const pDucking = s.ducking && !s.jumping;
        const ph = pDucking ? P_DUCK_H : P_SIZE;
        const pw = pDucking ? P_SIZE + 6 : P_SIZE;
        const py = pDucking ? GY - P_DUCK_H : s.py;
        const pL = PX + 4, pR = PX + pw - 4, pT = py + 3, pB = py + ph - 2;

        for (const ob of s.obstacles) {
          const oL = ob.x + 3, oR = ob.x + ob.w - 3, oT = GY - ob.h + 3, oB = GY;
          if (pR > oL && pL < oR && pB > oT && pT < oB) {
            triggerGameOver(s); break;
          }
        }
        if (!s.gameOver) {
          for (const ob of s.flyingObs) {
            const oL = ob.x + 2, oR = ob.x + ob.w - 2, oT = ob.y + 2, oB = ob.y + ob.h - 2;
            if (pR > oL && pL < oR && pB > oT && pT < oB) {
              triggerGameOver(s); break;
            }
          }
        }
      }

      drawScene(s);
      raf.current = requestAnimationFrame(tick);
    }

    function triggerGameOver(s) {
      s.gameOver = true;
      s.shakeT = 15;
      setGameOver(true);
      spawnParticles(s, PX + P_SIZE / 2, s.py + P_SIZE / 2, "#ef4444", 15);
      spawnParticles(s, PX + P_SIZE / 2, s.py + P_SIZE / 2, "#fbbf24", 8);
      const total = s.score + s.coins;
      if (total > highScore) {
        setHighScore(total);
        localStorage.setItem("retro_game_hi", String(total));
      }
    }

    if (started) {
      raf.current = requestAnimationFrame(tick);
    } else {
      drawScene(sr.current);
    }

    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [started, gameOver, highScore]);

  useEffect(() => {
    const down = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); }
      if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); keysRef.current.duck = true; }
    };
    const up = (e) => {
      if (e.code === "ArrowDown" || e.code === "KeyS") keysRef.current.duck = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [jump]);

  const finalScore = score + coins;

  return (
    <div className="w-full max-w-[600px] mx-auto mt-4">
      <div className="relative rounded-2xl overflow-hidden border border-card-border/50 bg-white/60 backdrop-blur-sm shadow-lg">
        <canvas
          ref={canvasRef} width={W} height={H}
          className="w-full h-auto cursor-pointer block"
          onClick={jump}
          onTouchStart={(e) => { e.preventDefault(); jump(); }}
        />

        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-lg animate-bounce">
                <span className="text-white text-2xl">🏃</span>
              </div>
              <p className="text-base font-bold text-foreground">Sprint Runner</p>
              <div className="space-y-1">
                <p className="text-xs text-muted">
                  <kbd className="px-1.5 py-0.5 rounded bg-card-border/30 font-mono text-[10px]">Space</kbd> / Tap to jump (double-jump!)
                </p>
                <p className="text-xs text-muted">
                  <kbd className="px-1.5 py-0.5 rounded bg-card-border/30 font-mono text-[10px]">↓</kbd> to duck under flyers
                </p>
              </div>
              <p className="text-[10px] text-muted/70">Collect coins & dodge obstacles</p>
            </div>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="text-center space-y-3">
              <div className="text-3xl">💥</div>
              <p className="text-base font-bold text-foreground">Game Over!</p>
              <div className="flex items-center justify-center gap-3 text-xs flex-wrap">
                <span className="text-muted">Score: <span className="font-bold text-foreground">{score}</span></span>
                <span className="text-muted">Coins: <span className="font-bold text-amber-500">{coins}</span></span>
                <span className="text-muted border-l pl-3 border-card-border/30">Total: <span className="font-extrabold text-indigo-600">{finalScore}</span></span>
              </div>
              <div className="text-xs text-muted">
                Best: <span className="font-bold text-amber-600">{Math.max(highScore, finalScore)}</span>
              </div>
              <p className="text-[10px] text-muted">Tap or <kbd className="px-1.5 py-0.5 rounded bg-card-border/30 font-mono">Space</kbd> to retry</p>
            </div>
          </div>
        )}
      </div>

      {started && !gameOver && (
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted font-medium">
              🏃 <span className="text-foreground font-bold">{score}</span>
            </span>
            <span className="text-[10px] text-muted font-medium">
              🪙 <span className="text-amber-500 font-bold">{coins}</span>
            </span>
            {combo > 1 && (
              <span className={`text-[10px] font-bold ${combo >= 5 ? "text-red-500" : combo >= 3 ? "text-amber-500" : "text-indigo-500"}`}>
                {combo}x
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted font-medium">
            🏆 <span className="text-amber-600 font-bold">{highScore}</span>
          </span>
        </div>
      )}
    </div>
  );
}
