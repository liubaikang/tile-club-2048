import { client } from './api';

export interface PlayerStats {
  games_played: number;
  best_score: number;
  best_tile: number;
  total_moves: number;
  last_played?: string | null;
}

export interface PlayerProfile {
  player_key: string;
  display_name: string;
  is_guest: boolean;
  stats: PlayerStats;
}

export interface LeaderboardRow {
  rank: number;
  player_key: string;
  display_name: string;
  score: number;
  best_tile: number;
  moves: number;
  is_guest: boolean;
  achieved_at?: string | null;
}

export interface ScoreHistoryRow {
  id: number;
  score: number;
  best_tile: number;
  moves: number;
  duration_seconds: number;
  created_at?: string | null;
}

const withQuery = (url: string, params?: Record<string, string | number>) => {
  if (!params) return url;
  const search = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString();
  return search ? `${url}?${search}` : url;
};

const invoke = async <T>(
  url: string,
  method: 'GET' | 'POST',
  data?: Record<string, unknown>,
  params?: Record<string, string | number>,
) => {
  const response = await client.apiCall.invoke({
    url: withQuery(url, params),
    method,
    ...(data ? { data } : {}),
  });
  return response.data as T;
};

/**
 * Guests are identified by a stable fingerprint of device signals stored in
 * localStorage, so the same browser keeps one identity across visits.
 */
const GUEST_KEY_STORAGE = 'tileclub.guest.key';
const GUEST_NAME_STORAGE = 'tileclub.guest.name';

const fingerprint = (): string => {
  const nav = window.navigator;
  const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const raw = [
    nav.userAgent,
    nav.language,
    (nav.languages ?? []).join(','),
    nav.platform ?? '',
    String(nav.hardwareConcurrency ?? ''),
    String(nav.maxTouchPoints ?? 0),
    screenInfo,
    String(window.devicePixelRatio ?? 1),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
  ].join('|');

  let hash = 0x811c9dc5;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const buildGuestIdentity = (): { playerKey: string; displayName: string } => {
  let deviceId = localStorage.getItem(GUEST_KEY_STORAGE);
  if (!deviceId) {
    deviceId = fingerprint();
    localStorage.setItem(GUEST_KEY_STORAGE, deviceId);
  }
  const tag = deviceId.slice(-4).toUpperCase();
  const storedName = localStorage.getItem(GUEST_NAME_STORAGE);
  return {
    playerKey: `guest_${deviceId}`,
    displayName: storedName || `Guest ${tag}`,
  };
};

export const rememberGuestName = (name: string) => {
  localStorage.setItem(GUEST_NAME_STORAGE, name);
};

export const syncPlayer = (playerKey: string, displayName: string, isGuest: boolean) =>
  invoke<PlayerProfile>('/api/v1/game/sync', 'POST', {
    player_key: playerKey,
    display_name: displayName,
    is_guest: isGuest,
  });

export const submitScore = (payload: {
  playerKey: string;
  score: number;
  bestTile: number;
  moves: number;
  durationSeconds: number;
}) =>
  invoke<PlayerProfile>('/api/v1/game/scores', 'POST', {
    player_key: payload.playerKey,
    score: payload.score,
    best_tile: payload.bestTile,
    moves: payload.moves,
    duration_seconds: payload.durationSeconds,
  });

export const renamePlayer = (playerKey: string, displayName: string) =>
  invoke<PlayerProfile>('/api/v1/game/rename', 'POST', {
    player_key: playerKey,
    display_name: displayName,
  });

export const fetchLeaderboard = (limit = 8) =>
  invoke<{ items: LeaderboardRow[]; total: number }>('/api/v1/game/leaderboard', 'GET', undefined, {
    limit,
  });

export const fetchHistory = (playerKey: string, limit = 8) =>
  invoke<{ items: ScoreHistoryRow[]; total: number }>('/api/v1/game/history', 'GET', undefined, {
    player_key: playerKey,
    limit,
  });

export const fetchAccountStats = (playerKey: string) => syncPlayer(playerKey, '', false);