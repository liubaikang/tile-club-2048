import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { SIZE, tileTone, type Direction, type GameState } from '@/lib/game2048';

const GAP = 2.4;
const CELL = `calc((100% - ${GAP * (SIZE - 1)}%) / ${SIZE})`;
const offset = (index: number) => `calc(${CELL} * ${index} + ${GAP}% * ${index})`;

interface GameBoardProps {
  state: GameState;
  onMove: (direction: Direction) => void;
  onNewGame: () => void;
  onUndo: () => void;
  onKeepPlaying: () => void;
  canUndo: boolean;
  locked?: boolean;
}

const GameBoard = ({
  state,
  onMove,
  onNewGame,
  onUndo,
  onKeepPlaying,
  canUndo,
  locked = false,
}: GameBoardProps) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const [boardWidth, setBoardWidth] = useState(480);

  useEffect(() => {
    const element = boardRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) setBoardWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const tileFontSize = (value: number) => {
    const digits = String(value).length;
    const factor = digits >= 4 ? 0.056 : digits === 3 ? 0.066 : 0.082;
    return `${Math.max(14, Math.round(boardWidth * factor))}px`;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (locked) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || locked) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      onMove(dx > 0 ? 'right' : 'left');
    } else {
      onMove(dy > 0 ? 'down' : 'up');
    }
  };

  const maxTile = state.tiles.reduce((best, tile) => Math.max(best, tile.value), 0);

  return (
    <div className="relative">
      <div
        ref={boardRef}
        className="board-shell select-none"
        role="application"
        aria-label={`2048 棋盘，当前最高瓦片 ${maxTile || '无'}，得分 ${state.score}。使用方向键或 WASD 移动瓦片。`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
        onPointerLeave={() => {
          pointerStart.current = null;
        }}
      >
        <div className="board-grid">
          {Array.from({ length: SIZE * SIZE }, (_, index) => (
            <div key={index} className="board-cell" aria-hidden="true" />
          ))}
        </div>

        <div className="tile-layer" aria-hidden="true">
          {state.tiles.map((tile) => (
            <div
              key={tile.id}
              className={[
                'tile',
                tileTone(tile.value),
                tile.isNew ? 'tile--new' : '',
                tile.isMerged ? 'tile--merged' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                left: offset(tile.col),
                top: offset(tile.row),
                width: CELL,
                height: CELL,
                fontSize: tileFontSize(tile.value),
              }}
            >
              {tile.value}
            </div>
          ))}
        </div>

        {(state.status === 'won' || state.status === 'lost') && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[20px] bg-[rgba(247,242,231,0.88)] p-4 backdrop-blur-[3px]">
            <div className="overlay-card w-full max-w-[300px] rounded-2xl border border-[#E3D6C3] bg-[#FFFDF8] p-6 text-center">
              <p className="label-caps">{state.status === 'won' ? '达成 2048' : '本局结束'}</p>
              <h2 className="display-font mt-2 text-[34px] text-[#241A12]">
                {state.status === 'won' ? '漂亮的一局' : '棋盘无路可走'}
              </h2>
              <p className="mt-2 text-sm text-[#6C5A4A]">
                本局得分 <span className="font-semibold text-[#241A12]">{state.score.toLocaleString()}</span>
                ，最高瓦片 {maxTile}。
              </p>
              <div className="mt-5 flex flex-col gap-2">
                {state.status === 'won' ? (
                  <button className="pill pill-primary w-full" onClick={onKeepPlaying}>
                    继续挑战
                  </button>
                ) : (
                  <button className="pill pill-primary w-full" onClick={onNewGame}>
                    再来一局
                  </button>
                )}
                <button className="pill pill-secondary w-full" onClick={onUndo} disabled={!canUndo}>
                  撤销上一步
                </button>
                {state.status === 'won' && (
                  <button className="pill pill-ghost w-full" onClick={onNewGame}>
                    开新的一局
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameBoard;