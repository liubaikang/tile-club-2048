export const SIZE = 4;
export const WIN_VALUE = 2048;
export const MAX_UNDO = 20;

export type Direction = 'up' | 'down' | 'left' | 'right';
export type GameStatus = 'playing' | 'won' | 'lost';

export interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  isNew: boolean;
  isMerged: boolean;
}

export interface GameState {
  tiles: Tile[];
  score: number;
  moves: number;
  status: GameStatus;
}

let tileSequence = 1;

const nextId = () => {
  tileSequence += 1;
  return tileSequence;
};

const inBounds = (row: number, col: number) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;

const emptyGrid = (): (Tile | null)[][] =>
  Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));

export const toGrid = (tiles: Tile[]): (Tile | null)[][] => {
  const grid = emptyGrid();
  tiles.forEach((tile) => {
    grid[tile.row][tile.col] = tile;
  });
  return grid;
};

export const emptyCells = (tiles: Tile[]): { row: number; col: number }[] => {
  const occupied = new Set(tiles.map((tile) => `${tile.row}:${tile.col}`));
  const cells: { row: number; col: number }[] = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!occupied.has(`${row}:${col}`)) cells.push({ row, col });
    }
  }
  return cells;
};

/** Adds one random tile (90% a 2, 10% a 4) to the empty cells. */
export const spawnTile = (tiles: Tile[], random: () => number = Math.random): Tile[] => {
  const free = emptyCells(tiles);
  if (free.length === 0) return tiles;
  const cell = free[Math.floor(random() * free.length) % free.length];
  const value = random() < 0.9 ? 2 : 4;
  return [...tiles, { id: nextId(), value, row: cell.row, col: cell.col, isNew: true, isMerged: false }];
};

export const createGame = (random: () => number = Math.random): GameState => {
  const withFirst = spawnTile([], random);
  return { tiles: spawnTile(withFirst, random), score: 0, moves: 0, status: 'playing' };
};

export const bestTile = (tiles: Tile[]): number =>
  tiles.reduce((best, tile) => Math.max(best, tile.value), 0);

/** True when at least one slide or merge is still possible. */
export const hasMoves = (tiles: Tile[]): boolean => {
  if (tiles.length < SIZE * SIZE) return true;
  const grid = toGrid(tiles);
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const tile = grid[row][col];
      if (!tile) return true;
      const right = col + 1 < SIZE ? grid[row][col + 1] : null;
      const down = row + 1 < SIZE ? grid[row + 1][col] : null;
      if (right && right.value === tile.value) return true;
      if (down && down.value === tile.value) return true;
    }
  }
  return false;
};

export interface MoveOutcome {
  tiles: Tile[];
  gained: number;
  moved: boolean;
}

/**
 * Slides every tile in `direction`, merging equal neighbours once per move.
 * Tile identities are preserved so the UI can animate positions.
 */
export const slide = (tiles: Tile[], direction: Direction): MoveOutcome => {
  const dr = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  const dc = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const grid = toGrid(tiles.map((tile) => ({ ...tile, isNew: false, isMerged: false })));
  const indexes = [0, 1, 2, 3];
  const rowOrder = dr > 0 ? [...indexes].reverse() : indexes;
  const colOrder = dc > 0 ? [...indexes].reverse() : indexes;
  const mergedIds = new Set<number>();
  let gained = 0;
  let moved = false;

  for (const row of rowOrder) {
    for (const col of colOrder) {
      const tile = grid[row][col];
      if (!tile) continue;

      let targetRow = row;
      let targetCol = col;
      let absorbed = false;

      for (let step = 1; step < SIZE; step += 1) {
        const nextRow = row + dr * step;
        const nextCol = col + dc * step;
        if (!inBounds(nextRow, nextCol)) break;

        const occupant = grid[nextRow][nextCol];
        if (!occupant) {
          targetRow = nextRow;
          targetCol = nextCol;
          continue;
        }

        if (occupant.value === tile.value && !mergedIds.has(occupant.id)) {
          grid[row][col] = null;
          occupant.value = tile.value * 2;
          occupant.isMerged = true;
          mergedIds.add(occupant.id);
          gained += occupant.value;
          moved = true;
          absorbed = true;
        }
        break;
      }

      if (absorbed) continue;

      if (targetRow !== row || targetCol !== col) {
        grid[row][col] = null;
        grid[targetRow][targetCol] = tile;
        tile.row = targetRow;
        tile.col = targetCol;
        moved = true;
      }
    }
  }

  return { tiles: grid.flat().filter((tile): tile is Tile => tile !== null), gained, moved };
};

export interface TurnResult {
  state: GameState;
  moved: boolean;
}

/** Applies a move and, when something changed, spawns the next tile. */
export const playMove = (
  state: GameState,
  direction: Direction,
  random: () => number = Math.random,
): TurnResult => {
  if (state.status === 'lost') return { state, moved: false };
  const outcome = slide(state.tiles, direction);
  if (!outcome.moved) return { state, moved: false };

  const tiles = spawnTile(outcome.tiles, random);
  const score = state.score + outcome.gained;
  const reachedWin = !state.status.startsWith('won') && bestTile(tiles) >= WIN_VALUE;
  const status: GameStatus = reachedWin ? 'won' : hasMoves(tiles) ? 'playing' : 'lost';

  return {
    state: { tiles, score, moves: state.moves + 1, status },
    moved: true,
  };
};

export const keepPlaying = (state: GameState): GameState =>
  state.status === 'won'
    ? { ...state, status: hasMoves(state.tiles) ? 'playing' : 'lost' }
    : state;

export const tileTone = (value: number): string => {
  if (value >= 4096) return 'tile--max';
  if (value >= 2048) return 'tile--2048';
  if (value >= 1024) return 'tile--1024';
  if (value >= 512) return 'tile--512';
  if (value >= 256) return 'tile--256';
  if (value >= 128) return 'tile--128';
  if (value >= 64) return 'tile--64';
  if (value >= 32) return 'tile--32';
  if (value >= 16) return 'tile--16';
  if (value >= 8) return 'tile--8';
  if (value >= 4) return 'tile--4';
  return 'tile--2';
};