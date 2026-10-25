/**
 * 2048 Game Core Engine
 * Co-designed with Claude Sonnet 5.5 & Antigravity
 * Pure JavaScript ES6+ (Zero DOM dependencies, fully testable)
 */

export const Direction = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
});

const EVENTS = ['move', 'scoreChange', 'gameOver', 'gameWon', 'undo', 'reset'];

export class Game2048Engine {
  #size;
  #random;
  #maxUndo;
  #winValue;
  #spawnTwoRate;

  #tiles = [];      // Array of Tile objects
  #score = 0;
  #won = false;
  #keepPlaying = false;
  #over = false;
  #nextId = 1;
  #history = [];
  #listeners = new Map(EVENTS.map((e) => [e, new Set()]));

  /**
   * @param {Object}   [options]
   * @param {number}   [options.size=4]
   * @param {Function} [options.random=Math.random]
   * @param {number}   [options.maxUndo=50]
   * @param {number}   [options.winValue=2048]
   * @param {number}   [options.initialTiles=2]
   * @param {number}   [options.spawnTwoRate=0.9]
   */
  constructor({
    size = 4,
    random = Math.random,
    maxUndo = 50,
    winValue = 2048,
    initialTiles = 2,
    spawnTwoRate = 0.9,
  } = {}) {
    if (!Number.isInteger(size) || size < 2) {
      throw new RangeError('size must be an integer >= 2');
    }
    this.#size = size;
    this.#random = random;
    this.#maxUndo = Math.max(0, maxUndo);
    this.#winValue = winValue;
    this.#spawnTwoRate = spawnTwoRate;
    this.#startNew(initialTiles);
  }

  /* ───────────────────────── Getters ───────────────────────── */

  get size() { return this.#size; }
  get score() { return this.#score; }
  get tiles() { return [...this.#tiles]; }
  get hasWon() { return this.#won; }
  get keepPlaying() { return this.#keepPlaying; }
  get isGameOver() { return this.#over; }
  get canUndo() { return this.#history.length > 0; }

  get board() {
    const grid = Array.from({ length: this.#size }, () => Array(this.#size).fill(0));
    for (const t of this.#tiles) {
      grid[t.row][t.col] = t.value;
    }
    return grid;
  }

  getState() {
    return {
      size: this.#size,
      tiles: this.tiles,
      score: this.#score,
      hasWon: this.#won,
      keepPlaying: this.#keepPlaying,
      isGameOver: this.#over,
      canUndo: this.canUndo,
      maxTile: this.#tiles.reduce((m, t) => Math.max(m, t.value), 0),
    };
  }

  /* ───────────────────────── Event API ───────────────────────── */

  on(event, callback) {
    const set = this.#listeners.get(event);
    if (!set) throw new Error(`Unknown event: ${event}`);
    set.add(callback);
    return () => set.delete(callback);
  }

  off(event, callback) {
    this.#listeners.get(event)?.delete(callback);
  }

  #emit(event, payload) {
    const set = this.#listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`Error in event listener for ${event}:`, err);
      }
    }
  }

  /* ───────────────────────── Core Game Operations ───────────────────────── */

  reset(initialTiles = 2) {
    this.#startNew(initialTiles);
    this.#emit('reset', this.getState());
  }

  continuePlaying() {
    this.#keepPlaying = true;
  }

  /**
   * Move tiles in specified direction
   * @param {'up'|'down'|'left'|'right'} direction
   * @returns {boolean} Whether move was valid and changed board state
   */
  move(direction) {
    if (this.#over) return false;

    const vectors = {
      [Direction.UP]: { r: -1, c: 0 },
      [Direction.DOWN]: { r: 1, c: 0 },
      [Direction.LEFT]: { r: 0, c: -1 },
      [Direction.RIGHT]: { r: 0, c: 1 },
    };

    const vector = vectors[direction];
    if (!vector) throw new Error(`Invalid direction: ${direction}`);

    // Build grid representation [row][col] => tile
    const grid = Array.from({ length: this.#size }, () => Array(this.#size).fill(null));
    for (const tile of this.#tiles) {
      grid[tile.row][tile.col] = tile;
    }

    // Traverse cells in order depending on movement direction
    const rowTraversals = [];
    const colTraversals = [];
    for (let pos = 0; pos < this.#size; pos++) {
      rowTraversals.push(pos);
      colTraversals.push(pos);
    }
    if (vector.r === 1) rowTraversals.reverse();
    if (vector.c === 1) colTraversals.reverse();

    let moved = false;
    let pointsAdded = 0;
    const nextTiles = [];
    const removedTiles = [];
    const mergedPositions = new Set(); // Prevent multiple merges in a single row/col

    // Save snapshot for undo BEFORE modifying state
    const snapshot = {
      tiles: this.#tiles.map(t => ({ ...t })),
      score: this.#score,
      won: this.#won,
      keepPlaying: this.#keepPlaying,
      over: this.#over,
    };

    // Prepare tiles: clear isNew and merged flags, record previous positions
    for (const t of this.#tiles) {
      t.prevRow = t.row;
      t.prevCol = t.col;
      t.isNew = false;
      t.merged = false;
    }

    for (const r of rowTraversals) {
      for (const c of colTraversals) {
        const tile = grid[r][c];
        if (!tile) continue;

        // Find farthest available cell in direction
        let farthest = { r, c };
        let next = { r: r + vector.r, c: c + vector.c };

        while (this.#isWithinBounds(next.r, next.c) && !grid[next.r][next.c]) {
          farthest = next;
          next = { r: next.r + vector.r, c: next.c + vector.c };
        }

        // Check if merge is possible with neighbor at next
        let mergedWithNeighbor = false;
        if (this.#isWithinBounds(next.r, next.c)) {
          const neighbor = grid[next.r][next.c];
          const posKey = `${next.r},${next.c}`;

          if (neighbor && neighbor.value === tile.value && !mergedPositions.has(posKey)) {
            // Merge occurs!
            mergedPositions.add(posKey);
            mergedWithNeighbor = true;

            const mergedValue = tile.value * 2;
            pointsAdded += mergedValue;

            // Target surviving tile
            neighbor.value = mergedValue;
            neighbor.merged = true;

            // The moving tile is absorbed
            tile.row = next.r;
            tile.col = next.c;
            removedTiles.push({
              id: tile.id,
              fromRow: tile.prevRow,
              fromCol: tile.prevCol,
              toRow: next.r,
              toCol: next.c,
              mergedIntoId: neighbor.id,
              value: tile.value,
            });

            // Clear current spot from grid
            grid[r][c] = null;
            moved = true;
          }
        }

        if (!mergedWithNeighbor) {
          if (farthest.r !== r || farthest.c !== c) {
            // Tile slid to new empty spot
            grid[r][c] = null;
            grid[farthest.r][farthest.c] = tile;
            tile.row = farthest.r;
            tile.col = farthest.c;
            moved = true;
          }
          nextTiles.push(tile);
        }
      }
    }

    if (!moved) {
      return false;
    }

    // Push previous state to history
    this.#history.push(snapshot);
    if (this.#history.length > this.#maxUndo) {
      this.#history.shift();
    }

    this.#tiles = nextTiles;
    this.#score += pointsAdded;
    if (pointsAdded > 0) {
      this.#emit('scoreChange', { score: this.#score, pointsAdded });
    }

    // Check if player won
    if (!this.#won && !this.#keepPlaying) {
      const reachedWin = this.#tiles.some(t => t.value >= this.#winValue);
      if (reachedWin) {
        this.#won = true;
        this.#emit('gameWon', this.getState());
      }
    }

    // Spawn a random new tile
    const spawnedTile = this.#spawnRandomTile();

    // Check game over
    if (!this.#hasAvailableMoves()) {
      this.#over = true;
      this.#emit('gameOver', this.getState());
    }

    this.#emit('move', {
      direction,
      tiles: this.tiles,
      removed: removedTiles,
      spawned: spawnedTile,
      score: this.#score,
      pointsAdded,
      hasWon: this.#won,
      isGameOver: this.#over,
      canUndo: this.canUndo,
    });

    return true;
  }

  undo() {
    if (!this.canUndo) return false;
    const prev = this.#history.pop();
    this.#tiles = prev.tiles;
    this.#score = prev.score;
    this.#won = prev.won;
    this.#keepPlaying = prev.keepPlaying;
    this.#over = prev.over;

    this.#emit('undo', this.getState());
    return true;
  }

  /* ───────────────────────── Internal Helpers ───────────────────────── */

  #startNew(initialTiles) {
    this.#tiles = [];
    this.#score = 0;
    this.#won = false;
    this.#keepPlaying = false;
    this.#over = false;
    this.#history = [];

    for (let i = 0; i < initialTiles; i++) {
      this.#spawnRandomTile();
    }
  }

  #isWithinBounds(r, c) {
    return r >= 0 && r < this.#size && c >= 0 && c < this.#size;
  }

  #getAvailableCells() {
    const occupied = new Set(this.#tiles.map(t => `${t.row},${t.col}`));
    const empty = [];
    for (let r = 0; r < this.#size; r++) {
      for (let c = 0; c < this.#size; c++) {
        if (!occupied.has(`${r},${c}`)) {
          empty.push({ row: r, col: c });
        }
      }
    }
    return empty;
  }

  #spawnRandomTile() {
    const cells = this.#getAvailableCells();
    if (cells.length === 0) return null;

    const cellIndex = Math.floor(this.#random() * cells.length);
    const cell = cells[cellIndex];
    const value = this.#random() < this.#spawnTwoRate ? 2 : 4;

    const tile = {
      id: this.#nextId++,
      value,
      row: cell.row,
      col: cell.col,
      prevRow: cell.row,
      prevCol: cell.col,
      isNew: true,
      merged: false,
    };

    this.#tiles.push(tile);
    return tile;
  }

  #hasAvailableMoves() {
    if (this.#getAvailableCells().length > 0) return true;

    // Check if any neighboring tiles have identical values
    const grid = this.board;
    for (let r = 0; r < this.#size; r++) {
      for (let c = 0; c < this.#size; c++) {
        const val = grid[r][c];
        if (r < this.#size - 1 && grid[r + 1][c] === val) return true;
        if (c < this.#size - 1 && grid[r][c + 1] === val) return true;
      }
    }
    return false;
  }
}
