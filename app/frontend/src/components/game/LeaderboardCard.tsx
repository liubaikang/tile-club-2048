import { useCallback, useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardRow } from '@/lib/gameApi';
import { usePlayer } from '@/contexts/PlayerContext';

const rankTone = (rank: number) => {
  if (rank === 1) return 'text-[#8C3120]';
  if (rank === 2) return 'text-[#B1432E]';
  if (rank === 3) return 'text-[#C48338]';
  return 'text-[#9C8875]';
};

export interface LeaderboardRef {
  reload: () => void;
}

const LeaderboardCard = () => {
  const { identity, refreshKey } = usePlayer();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await fetchLeaderboard(8);
      setRows(response.items);
      setTotal(response.total);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <section className="club-card flex flex-1 flex-col p-5" aria-label="排行榜">
      <div className="flex items-baseline justify-between">
        <p className="label-caps">排行榜 · 最高分</p>
        <span className="text-[11px] text-[#9C8875]">{total > 0 ? `${total} 位玩家` : '—'}</span>
      </div>

      <div className="mt-3 flex-1">
        {state === 'loading' && (
          <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-8 animate-pulse rounded-lg bg-[#F1E9DA]" />
            ))}
          </div>
        )}

        {state === 'error' && (
          <div className="py-6 text-center">
            <p className="text-[13px] text-[#6C5A4A]">排行榜暂时不可用。</p>
            <button className="mt-2 text-[12px] font-semibold text-[#D4643F] underline" onClick={load}>
              重新加载
            </button>
          </div>
        )}

        {state === 'ready' && rows.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-[13px] text-[#6C5A4A]">还没有成绩记录。</p>
            <p className="mt-1 text-[12px] text-[#9C8875]">完成第一局，就能占据榜首。</p>
          </div>
        )}

        {state === 'ready' && rows.length > 0 && (
          <ol className="divide-y divide-[#F0E6D6]">
            {rows.map((row) => {
              const isMe = row.player_key === identity.playerKey;
              return (
                <li
                  key={`${row.player_key}-${row.rank}`}
                  className={`flex items-center gap-3 py-2 text-[13px] ${
                    isMe ? 'rounded-md bg-[#FBF4E7] px-2' : ''
                  }`}
                >
                  <span className={`display-font w-5 text-[15px] ${rankTone(row.rank)}`}>
                    {row.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[#241A12]">
                    {row.display_name}
                    {isMe && <span className="ml-1 text-[11px] text-[#D4643F]">你</span>}
                  </span>
                  <span className="tabular-nums font-semibold text-[#3D2F27]">
                    {row.score.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <p className="mt-3 border-t border-[#E3D6C3] pt-3 text-[11px] text-[#9C8875]">
        每位玩家取单局最高分参与排名。
      </p>
    </section>
  );
};

export default LeaderboardCard;