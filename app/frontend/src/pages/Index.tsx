import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Keyboard, RotateCcw, Sparkles, Trophy, Undo2 } from 'lucide-react';
import GameBoard from '@/components/game/GameBoard';
import ScoreCard from '@/components/game/ScoreCard';
import IdentityCard from '@/components/game/IdentityCard';
import LeaderboardCard from '@/components/game/LeaderboardCard';
import { usePlayer } from '@/contexts/PlayerContext';
import {
  bestTile,
  createGame,
  keepPlaying,
  playMove,
  type Direction,
  type GameState,
} from '@/lib/game2048';

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};

const Index = () => {
  const { submitRun, displayName, isGuest, bestScore } = usePlayer();
  const [state, setState] = useState<GameState>(() => createGame());
  const [history, setHistory] = useState<GameState[]>([]);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const submittedRef = useRef(false);

  const restart = useCallback(() => {
    setState(createGame());
    setHistory([]);
    setStartedAt(Date.now());
    submittedRef.current = false;
  }, []);

  const move = useCallback((direction: Direction) => {
    setState((current) => {
      const result = playMove(current, direction);
      if (!result.moved) return current;
      setHistory((stack) => [...stack.slice(-19), current]);
      return result.state;
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setState(previous);
      return stack.slice(0, -1);
    });
  }, []);

  const keepGoing = useCallback(() => {
    setState((current) => keepPlaying(current));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      const direction = KEY_MAP[event.key];
      if (!direction) return;
      event.preventDefault();
      move(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [move]);

  useEffect(() => {
    if (state.status !== 'lost' || submittedRef.current) return;
    submittedRef.current = true;
    void submitRun({
      score: state.score,
      bestTile: bestTile(state.tiles),
      moves: state.moves,
      durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
    });
  }, [state.status, state.score, state.tiles, state.moves, startedAt, submitRun]);

  const maxTile = bestTile(state.tiles);

  return (
    <div className="paper-grain min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-5 pb-10 pt-6 sm:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3D2F27] text-[13px] font-bold text-[#FFF8EE]"
              aria-hidden="true"
            >
              TC
            </div>
            <div>
              <p className="text-[12px] font-bold tracking-[0.22em] text-[#241A12]">TILE CLUB</p>
              <p className="text-[11px] tracking-[0.18em] text-[#9C8875]">2048 · 瓦片俱乐部</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-right text-[11px] leading-tight tracking-[0.14em] text-[#9C8875] sm:block">
              小步移动
              <br />
              更大的数字
            </span>
            <Link to="/docs" className="pill pill-ghost">
              过程文档
            </Link>
            <Link to="/account" className="pill pill-ghost">
              账户
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <main className="min-w-0 flex-1 lg:max-w-[62%]">
            <p className="label-caps">Tile Club / 2048</p>
            <h1 className="display-font mt-2 text-[42px] leading-[1.05] text-[#241A12] sm:text-[56px] lg:text-[62px]">
              <span className="block whitespace-nowrap">滑动，合并，</span>
              <span className="block whitespace-nowrap text-[#D4643F]">一路向上。</span>
            </h1>
            <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-[#6C5A4A]">
              合并相同的数字瓦片，冲击 2048。目标是 2048，你可以一直玩到棋盘再无空隙。
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <button className="pill pill-primary" onClick={restart}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                新开一局
              </button>
              <button className="pill pill-secondary" onClick={undo} disabled={history.length === 0}>
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                撤销
              </button>
              <button
                className="pill pill-ghost"
                onClick={() => document.getElementById('how-to-play')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Keyboard className="h-4 w-4" aria-hidden="true" />
                操作说明
              </button>
            </div>

            <div className="mt-6">
              <GameBoard
                state={state}
                onMove={move}
                onNewGame={restart}
                onUndo={undo}
                onKeepPlaying={keepGoing}
                canUndo={history.length > 0}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#6C5A4A]">
              <span className="tabular-nums">
                得分 {state.score.toLocaleString()} · 最高瓦片 {maxTile}
              </span>
              <span className="text-[#9C8875]">
                {isGuest ? '游客成绩会自动归档' : `已登录 · ${displayName}`}
              </span>
            </div>
          </main>

          <aside className="flex w-full flex-col gap-4 lg:w-[38%] lg:max-w-[400px]">
            <ScoreCard score={state.score} best={Math.max(bestScore, state.score)} moves={state.moves} />
            <IdentityCard />
            <LeaderboardCard />
          </aside>
        </div>

        <section id="how-to-play" className="club-card mt-8 p-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#D4643F]" aria-hidden="true" />
            <p className="label-caps">操作说明 · 计分规则</p>
          </div>
          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            <div>
              <p className="text-[14px] font-semibold text-[#241A12]">1 · 移动</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6C5A4A]">
                使用方向键或 WASD，移动端直接在棋盘上滑动。所有瓦片朝同一方向滑到底。
              </p>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#241A12]">2 · 合并</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6C5A4A]">
                两个相同数字相撞会合并成它们的和，并获得同等分值。每次合并每块瓦片只发生一次。
              </p>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#241A12]">3 · 结算</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6C5A4A]">
                棋盘填满且无法合并时本局结束，成绩自动写入排行榜。撤销最多可回退 20 步。
              </p>
            </div>
          </div>
          <p className="mt-5 flex items-center gap-2 border-t border-[#E3D6C3] pt-3 text-[11px] text-[#9C8875]">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            当前浏览器身份：{isGuest ? '游客（按设备信息生成）' : `账户 ${displayName}`} · 换设备时可用账户登录继续。
          </p>
        </section>
      </div>
    </div>
  );
};

export default Index;