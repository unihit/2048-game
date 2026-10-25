import { Game2048Engine, Direction } from './engine.js';

// DOM Elements
const tilesLayer = document.getElementById('tiles-layer');
const currentScoreEl = document.getElementById('current-score');
const bestScoreEl = document.getElementById('best-score');
const scoreAdditionEl = document.getElementById('score-addition');
const btnUndo = document.getElementById('btn-undo');
const btnRestart = document.getElementById('btn-restart');
const btnSound = document.getElementById('btn-sound');
const soundIcon = document.getElementById('sound-icon');

const overlayGameOver = document.getElementById('overlay-game-over');
const overlayWin = document.getElementById('overlay-win');
const btnGameOverUndo = document.getElementById('btn-gameover-undo');
const btnGameOverRestart = document.getElementById('btn-gameover-restart');
const btnWinContinue = document.getElementById('btn-win-continue');
const btnWinRestart = document.getElementById('btn-win-restart');

// Local Storage Keys
const STORAGE_BEST_SCORE = '2048_best_score';
const STORAGE_SOUND_MUTED = '2048_sound_muted';

let bestScore = parseInt(localStorage.getItem(STORAGE_BEST_SCORE) || '0', 10);
let isMuted = localStorage.getItem(STORAGE_SOUND_MUTED) === 'true';

// Audio Synthesizer (Web Audio API)
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

const SoundFX = {
  slide() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  },

  merge(value) {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const baseFreq = 220 + Math.min(10, Math.log2(value)) * 60;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc2.frequency.setValueAtTime(baseFreq * 1.5, ctx.currentTime); // Perfect fifth harmonic

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.22);
    osc2.stop(ctx.currentTime + 0.22);
  },

  spawn() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(460, ctx.currentTime + 0.07);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  },

  win() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.1);
      osc.stop(ctx.currentTime + idx * 0.1 + 0.35);
    });
  },

  gameOver() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const notes = [240, 200, 160, 130];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.14);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.14);
      osc.stop(ctx.currentTime + idx * 0.14 + 0.2);
    });
  }
};

// Initialize Engine
const engine = new Game2048Engine({
  size: 4,
  winValue: 2048,
});

// Map of active Tile ID -> DOM Element
const tileElements = new Map();

function updateSoundUI() {
  soundIcon.textContent = isMuted ? '🔇' : '🔊';
  btnSound.title = isMuted ? '효과음 켜기 (M)' : '효과음 끄기 (M)';
}

function updateScoreUI(score, pointsAdded = 0) {
  currentScoreEl.textContent = score;

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(STORAGE_BEST_SCORE, bestScore.toString());
  }
  bestScoreEl.textContent = bestScore;

  if (pointsAdded > 0) {
    scoreAdditionEl.textContent = `+${pointsAdded}`;
    scoreAdditionEl.classList.remove('show');
    // Force reflow
    void scoreAdditionEl.offsetWidth;
    scoreAdditionEl.classList.add('show');
  }
}

function getTileClass(value) {
  return value <= 2048 ? `tile-${value}` : 'tile-super';
}

function createTileElement(tile) {
  const el = document.createElement('div');
  el.className = `tile ${getTileClass(tile.value)}`;
  el.dataset.id = tile.id;
  el.dataset.row = tile.row;
  el.dataset.col = tile.col;
  el.textContent = tile.value;
  return el;
}

function fullRender() {
  tilesLayer.innerHTML = '';
  tileElements.clear();

  for (const tile of engine.tiles) {
    const el = createTileElement(tile);
    tilesLayer.appendChild(el);
    tileElements.set(tile.id, el);
  }

  updateScoreUI(engine.score);
  btnUndo.disabled = !engine.canUndo;
  overlayGameOver.classList.toggle('show', engine.isGameOver);
  overlayWin.classList.toggle('show', engine.hasWon && !engine.keepPlaying);
}

// ───────────────────────── Engine Event Handlers ─────────────────────────

engine.on('move', ({ tiles, removed, spawned, score, pointsAdded, hasWon, isGameOver, canUndo }) => {
  SoundFX.slide();

  // 1. Handle removed (merged away) tiles: slide them to destination then remove
  for (const r of removed) {
    const el = tileElements.get(r.id);
    if (el) {
      el.dataset.row = r.toRow;
      el.dataset.col = r.toCol;
      el.classList.add('tile-removed');
      tileElements.delete(r.id);
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 120);
    }
  }

  // 2. Update existing and surviving tiles
  let maxMergedValue = 0;
  for (const t of tiles) {
    let el = tileElements.get(t.id);
    if (el) {
      el.dataset.row = t.row;
      el.dataset.col = t.col;

      if (t.merged) {
        maxMergedValue = Math.max(maxMergedValue, t.value);
        el.textContent = t.value;
        el.className = `tile ${getTileClass(t.value)} tile-merged`;
        // Remove animation class after pulse finishes
        setTimeout(() => el.classList.remove('tile-merged'), 220);
      }
    }
  }

  if (maxMergedValue > 0) {
    SoundFX.merge(maxMergedValue);
  }

  // 3. Render newly spawned tile
  if (spawned) {
    const el = createTileElement(spawned);
    el.classList.add('tile-new');
    tilesLayer.appendChild(el);
    tileElements.set(spawned.id, el);
    SoundFX.spawn();
    setTimeout(() => el.classList.remove('tile-new'), 200);
  }

  // 4. Update Score & Controls
  updateScoreUI(score, pointsAdded);
  btnUndo.disabled = !canUndo;

  if (hasWon && !engine.keepPlaying) {
    setTimeout(() => {
      overlayWin.classList.add('show');
      SoundFX.win();
    }, 280);
  } else if (isGameOver) {
    setTimeout(() => {
      overlayGameOver.classList.add('show');
      SoundFX.gameOver();
    }, 280);
  }
});

engine.on('undo', () => {
  fullRender();
});

engine.on('reset', () => {
  fullRender();
});

// ───────────────────────── User Interaction ─────────────────────────

function handleDirection(dir) {
  engine.move(dir);
}

// Keyboard
window.addEventListener('keydown', (e) => {
  // Ignore input if user is typing in form controls
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch (e.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      e.preventDefault();
      handleDirection(Direction.UP);
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      e.preventDefault();
      handleDirection(Direction.DOWN);
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      e.preventDefault();
      handleDirection(Direction.LEFT);
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      e.preventDefault();
      handleDirection(Direction.RIGHT);
      break;
    case 'u':
    case 'U':
      if (engine.canUndo) engine.undo();
      break;
    case 'r':
    case 'R':
      engine.reset();
      break;
    case 'm':
    case 'M':
      toggleSound();
      break;
  }
});

// Touch Swipe Handling
let touchStartX = 0;
let touchStartY = 0;
const SWIPE_THRESHOLD = 30;

window.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
}, { passive: true });

window.addEventListener('touchend', (e) => {
  if (!touchStartX || !touchStartY) return;
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;

  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (Math.max(absDx, absDy) > SWIPE_THRESHOLD) {
    if (absDx > absDy) {
      handleDirection(dx > 0 ? Direction.RIGHT : Direction.LEFT);
    } else {
      handleDirection(dy > 0 ? Direction.DOWN : Direction.UP);
    }
  }

  touchStartX = 0;
  touchStartY = 0;
}, { passive: true });

// Button Listeners
btnUndo.addEventListener('click', () => {
  if (engine.canUndo) engine.undo();
});

btnRestart.addEventListener('click', () => {
  engine.reset();
});

function toggleSound() {
  isMuted = !isMuted;
  localStorage.setItem(STORAGE_SOUND_MUTED, isMuted.toString());
  updateSoundUI();
}
btnSound.addEventListener('click', toggleSound);

btnGameOverUndo.addEventListener('click', () => {
  overlayGameOver.classList.remove('show');
  if (engine.canUndo) engine.undo();
});

btnGameOverRestart.addEventListener('click', () => {
  overlayGameOver.classList.remove('show');
  engine.reset();
});

btnWinContinue.addEventListener('click', () => {
  overlayWin.classList.remove('show');
  engine.continuePlaying();
});

btnWinRestart.addEventListener('click', () => {
  overlayWin.classList.remove('show');
  engine.reset();
});

// Initial Setup
updateSoundUI();
bestScoreEl.textContent = bestScore;
fullRender();
