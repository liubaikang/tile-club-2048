import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Fingerprint,
  Loader2,
  LogIn,
  LogOut,
  Pencil,
  RefreshCw,
  Trophy,
  UserRound,
} from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { NameDialog } from '@/components/game/IdentityCard';
import { fetchHistory, type ScoreHistoryRow } from '@/lib/gameApi';

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} 分钟` : `${minutes} 分 ${rest} 秒`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const AccountPage = () => {
  const {
    identity,
    displayName,
    isGuest,
    isAuthenticated,
    accountEmail,
    guestDeviceTag,
    profile,
    bestScore,
    login,
    logout,
    rename,
    refresh,
    resetGuestIdentity,
    authLoading,
  } = usePlayer();

  const [history, setHistory] = useState<ScoreHistoryRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [renaming, setRenaming] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadHistory = useCallback(async () => {
    setState('loading');
    try {
      const response = await fetchHistory(identity.playerKey, 10);
      setHistory(response.items);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [identity.playerKey]);

  useEffect(() => {
    if (authLoading) return;
    loadHistory();
  }, [authLoading, loadHistory]);

  const stats = profile?.stats;

  return (
    <div className="paper-grain min-h-screen">
      <div className="mx-auto w-full max-w-[960px] px-5 pb-12 pt-6 sm:px-8">
        <header className="flex items-center justify-between gap-3">
          <Link to="/" className="pill pill-ghost">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            返回游戏
          </Link>
          <div className="text-right">
            <p className="text-[12px] font-bold tracking-[0.22em] text-[#241A12]">TILE CLUB</p>
            <p className="text-[11px] tracking-[0.16em] text-[#9C8875]">账户管理</p>
          </div>
        </header>

        <h1 className="display-font mt-7 text-[38px] text-[#241A12] sm:text-[48px]">你的俱乐部档案</h1>
        <p className="mt-2 max-w-[58ch] text-[14px] leading-relaxed text-[#6C5A4A]">
          游客身份依据设备浏览器信息生成，可直接开始游戏；登录账户后，成绩会跟随账户在任意设备上保留。
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <section className="club-card p-6" aria-label="身份信息">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFE6D6] text-[18px] font-semibold text-[#3D2F27]"
                aria-hidden="true"
              >
                {displayName.charAt(0).toUpperCase() || 'G'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[17px] font-semibold text-[#241A12]">{displayName}</p>
                  {isAuthenticated && (
                    <BadgeCheck className="h-4 w-4 text-[#D4643F]" aria-label="已验证账户" />
                  )}
                </div>
                <p className="truncate text-[12px] text-[#6C5A4A]">
                  {isGuest ? `游客 · 设备 ${guestDeviceTag}` : accountEmail}
                </p>
              </div>
            </div>

            <dl className="mt-5 space-y-2 border-t border-[#E3D6C3] pt-4 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#6C5A4A]">身份类型</dt>
                <dd className="flex items-center gap-1.5 font-medium text-[#241A12]">
                  {isGuest ? (
                    <>
                      <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" /> 游客身份
                    </>
                  ) : (
                    <>
                      <UserRound className="h-3.5 w-3.5" aria-hidden="true" /> 正式账户
                    </>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#6C5A4A]">身份标识</dt>
                <dd className="truncate font-mono text-[12px] text-[#3D2F27]">
                  {identity.playerKey.slice(0, 18)}
                  {identity.playerKey.length > 18 ? '…' : ''}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#6C5A4A]">完成局数</dt>
                <dd className="font-medium tabular-nums text-[#241A12]">{stats?.games_played ?? 0}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#6C5A4A]">最高单局</dt>
                <dd className="font-medium tabular-nums text-[#241A12]">{bestScore.toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#6C5A4A]">最高瓦片</dt>
                <dd className="font-medium tabular-nums text-[#241A12]">{stats?.best_tile ?? 0}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-col gap-2">
              {isGuest ? (
                <button className="pill pill-primary w-full" onClick={login} disabled={authLoading}>
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  登录 / 注册账户
                </button>
              ) : (
                <button className="pill pill-secondary w-full" onClick={logout}>
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  退出登录
                </button>
              )}
              <div className="flex gap-2">
                <button className="pill pill-ghost flex-1" onClick={() => setRenaming(true)}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  修改昵称
                </button>
                {isGuest && (
                  <button
                    className="pill pill-ghost flex-1"
                    onClick={() => {
                      setResetting(true);
                      resetGuestIdentity();
                      setTimeout(() => setResetting(false), 600);
                    }}
                    disabled={resetting}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin' : ''}`} aria-hidden="true" />
                    重置游客身份
                  </button>
                )}
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-[#9C8875]">
              重置后本设备会获得一个全新的游客身份，原游客成绩仍保留在原身份下。
            </p>
          </section>

          <section className="club-card flex flex-col p-6" aria-label="对局记录">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-[#D4643F]" aria-hidden="true" />
                <p className="label-caps">最近对局</p>
              </div>
              <button
                className="flex items-center gap-1 text-[12px] font-medium text-[#6C5A4A] hover:text-[#241A12]"
                onClick={() => {
                  void refresh();
                  void loadHistory();
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                刷新
              </button>
            </div>

            {state === 'loading' && (
              <div className="mt-4 space-y-2" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="h-11 animate-pulse rounded-lg bg-[#F1E9DA]" />
                ))}
              </div>
            )}

            {state === 'error' && (
              <div className="py-10 text-center">
                <p className="text-[13px] text-[#6C5A4A]">对局记录加载失败。</p>
                <button
                  className="mt-2 text-[12px] font-semibold text-[#D4643F] underline"
                  onClick={loadHistory}
                >
                  重新加载
                </button>
              </div>
            )}

            {state === 'ready' && history.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <p className="text-[14px] font-medium text-[#241A12]">还没有完成的对局</p>
                <p className="mt-1 text-[12px] text-[#9C8875]">结束一局后，成绩会自动记录在这里。</p>
                <Link to="/" className="pill pill-primary mt-4">
                  <Loader2 className="hidden" aria-hidden="true" />
                  开始第一局
                </Link>
              </div>
            )}

            {state === 'ready' && history.length > 0 && (
              <ul className="mt-4 divide-y divide-[#F0E6D6]">
                {history.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold tabular-nums text-[#241A12]">
                        {row.score.toLocaleString()} 分
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#9C8875]">
                        {formatDate(row.created_at)} · {row.moves} 步 · 用时 {formatDuration(row.duration_seconds)}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#F1E9DA] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#3D2F27]">
                      最高 {row.best_tile}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <NameDialog
        open={renaming}
        title="修改昵称"
        description="昵称会显示在排行榜上，历史成绩将同步更新。"
        initialValue={displayName}
        confirmLabel="保存"
        onCancel={() => setRenaming(false)}
        onConfirm={async (value) => {
          await rename(value);
          setRenaming(false);
        }}
      />
    </div>
  );
};

export default AccountPage;