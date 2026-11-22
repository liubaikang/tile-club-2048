import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  buildGuestIdentity,
  rememberGuestName,
  renamePlayer,
  submitScore,
  syncPlayer,
  type PlayerProfile,
} from '../lib/gameApi';

export interface PlayerIdentity {
  playerKey: string;
  displayName: string;
  isGuest: boolean;
}

export interface RunSummary {
  score: number;
  bestTile: number;
  moves: number;
  durationSeconds: number;
}

interface PlayerContextValue {
  identity: PlayerIdentity;
  profile: PlayerProfile | null;
  displayName: string;
  isGuest: boolean;
  bestScore: number;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  accountEmail: string | null;
  login: () => void;
  logout: () => void;
  rename: (name: string) => Promise<void>;
  submitRun: (run: RunSummary) => Promise<void>;
  refresh: () => Promise<void>;
  resetGuestIdentity: () => void;
  guestDeviceTag: string;
  refreshKey: number;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const bestStorageKey = (playerKey: string) => `tileclub.best.${playerKey}`;

const readLocalBest = (playerKey: string): number => {
  const raw = localStorage.getItem(bestStorageKey(playerKey));
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading, login, logout } = useAuth();
  const [guest, setGuest] = useState(() => buildGuestIdentity());
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localBest, setLocalBest] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const baseIdentity = useMemo<PlayerIdentity>(() => {
    if (user) {
      const fallback = user.email?.split('@')[0]?.trim();
      return {
        playerKey: user.id,
        displayName: user.name?.trim() || fallback || '玩家',
        isGuest: false,
      };
    }
    return { playerKey: guest.playerKey, displayName: guest.displayName, isGuest: true };
  }, [user, guest]);

  const baseRef = useRef(baseIdentity);
  baseRef.current = baseIdentity;

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setLoading(true);
    const base = baseRef.current;
    setLocalBest(readLocalBest(base.playerKey));

    syncPlayer(base.playerKey, base.displayName, base.isGuest)
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
        setError('暂时无法连接排行榜服务，本局成绩仍会保存在本地。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, baseIdentity.playerKey]);

  const refresh = useCallback(async () => {
    const base = baseRef.current;
    try {
      const next = await syncPlayer(base.playerKey, base.displayName, base.isGuest);
      setProfile(next);
      setError(null);
    } catch {
      setError('刷新失败，请稍后再试。');
    }
  }, []);

  const submitRun = useCallback(async (run: RunSummary) => {
    const base = baseRef.current;
    const localNext = Math.max(readLocalBest(base.playerKey), run.score);
    localStorage.setItem(bestStorageKey(base.playerKey), String(localNext));
    setLocalBest(localNext);

    try {
      const next = await submitScore({
        playerKey: base.playerKey,
        score: run.score,
        bestTile: run.bestTile,
        moves: run.moves,
        durationSeconds: run.durationSeconds,
      });
      setProfile(next);
      setError(null);
      setRefreshKey((key) => key + 1);
    } catch {
      setError('成绩未能同步到排行榜，已保存在本机。');
    }
  }, []);

  const rename = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('昵称不能为空');
    const base = baseRef.current;
    const next = await renamePlayer(base.playerKey, trimmed);
    setProfile(next);
    setRefreshKey((key) => key + 1);
    if (base.isGuest) {
      rememberGuestName(next.display_name);
      setGuest((current) => ({ ...current, displayName: next.display_name }));
    }
  }, []);

  const resetGuestIdentity = useCallback(() => {
    localStorage.removeItem('tileclub.guest.key');
    localStorage.removeItem('tileclub.guest.name');
    const fresh = buildGuestIdentity();
    setGuest(fresh);
    setProfile(null);
    setLocalBest(readLocalBest(fresh.playerKey));
  }, []);

  const bestScore = Math.max(profile?.stats.best_score ?? 0, localBest);

  const value: PlayerContextValue = {
    identity: {
      playerKey: profile?.player_key ?? baseIdentity.playerKey,
      displayName: profile?.display_name ?? baseIdentity.displayName,
      isGuest: profile?.is_guest ?? baseIdentity.isGuest,
    },
    profile,
    displayName: profile?.display_name ?? baseIdentity.displayName,
    isGuest: profile?.is_guest ?? baseIdentity.isGuest,
    bestScore,
    loading,
    error,
    isAuthenticated: Boolean(user),
    authLoading,
    accountEmail: user?.email ?? null,
    login,
    logout,
    rename,
    submitRun,
    refresh,
    resetGuestIdentity,
    guestDeviceTag: baseIdentity.playerKey.slice(-4).toUpperCase(),
    refreshKey,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
};