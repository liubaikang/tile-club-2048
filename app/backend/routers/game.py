"""Game identity, score submission and leaderboard APIs for TILE CLUB 2048."""

from __future__ import annotations

import logging
from typing import Any, Optional

from core.auth import AccessTokenError, decode_access_token
from core.database import get_db
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from models.game_players import GamePlayers
from models.game_scores import GameScores
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/game", tags=["game"])
logger = logging.getLogger(__name__)

GUEST_PREFIX = "guest_"
MAX_SCORE = 10_000_000


class PlayerIdentity(BaseModel):
    player_key: str = Field(min_length=4, max_length=120)
    display_name: str = Field(min_length=1, max_length=40)
    is_guest: bool = True


class ScorePayload(BaseModel):
    player_key: str = Field(min_length=4, max_length=120)
    score: int = Field(ge=0, le=MAX_SCORE)
    best_tile: int = Field(ge=2, le=131072)
    moves: int = Field(ge=0, le=10_000_000)
    duration_seconds: int = Field(ge=0, le=86_400 * 30)


class RenamePayload(BaseModel):
    player_key: str = Field(min_length=4, max_length=120)
    display_name: str = Field(min_length=1, max_length=40)


class PlayerStats(BaseModel):
    games_played: int
    best_score: int
    best_tile: int
    total_moves: int
    last_played: Optional[str] = None


class PlayerProfile(BaseModel):
    player_key: str
    display_name: str
    is_guest: bool
    stats: PlayerStats


class LeaderboardRow(BaseModel):
    rank: int
    player_key: str
    display_name: str
    score: int
    best_tile: int
    moves: int
    is_guest: bool
    achieved_at: Optional[str] = None


class LeaderboardResponse(BaseModel):
    items: list[LeaderboardRow]
    total: int


class ScoreHistoryRow(BaseModel):
    id: int
    score: int
    best_tile: int
    moves: int
    duration_seconds: int
    created_at: Optional[str] = None


class ScoreHistoryResponse(BaseModel):
    items: list[ScoreHistoryRow]
    total: int


def _iso(value: Any) -> Optional[str]:
    return value.isoformat() if value is not None and hasattr(value, "isoformat") else None


async def get_optional_user(request: Request):
    """Resolve the signed-in user when a valid bearer token is present."""
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    token = header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        payload = decode_access_token(token)
    except AccessTokenError:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return {
        "id": str(user_id),
        "email": payload.get("email") or "",
        "name": payload.get("name") or "",
    }


def _clean_name(value: str, fallback: str) -> str:
    cleaned = " ".join(value.split())[:24].strip()
    return cleaned or fallback


def _default_name(seed: str) -> str:
    tail = "".join(ch for ch in seed if ch.isalnum())[-4:].upper() or "PLAYER"
    return f"Guest {tail}"


def _resolve_identity(
    user: Optional[dict[str, Any]],
    player_key: str,
    is_guest: bool,
    display_name: str,
) -> tuple[str, bool, str]:
    """Authenticated users can only write scores under their own key."""
    if user is not None:
        fallback = (user["name"] or user["email"].split("@")[0] or "Player").strip()
        return user["id"], False, _clean_name(display_name, fallback or "Player")
    key = player_key.strip()
    if not key.startswith(GUEST_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Guest identity must start with guest_",
        )
    return key, is_guest, _clean_name(display_name, _default_name(key))


def _is_power_of_two(value: int) -> bool:
    return value > 0 and (value & (value - 1)) == 0


async def _upsert_player(
    db: AsyncSession,
    player_key: str,
    display_name: str,
    is_guest: bool,
    overwrite_name: bool = False,
) -> GamePlayers:
    player = (
        await db.execute(select(GamePlayers).where(GamePlayers.player_key == player_key))
    ).scalar_one_or_none()
    if player is None:
        player = GamePlayers(player_key=player_key, display_name=display_name, is_guest=is_guest)
        db.add(player)
    else:
        if overwrite_name:
            player.display_name = display_name
        player.is_guest = is_guest
    await db.commit()
    await db.refresh(player)
    return player


async def _stats_for(db: AsyncSession, player_key: str) -> PlayerStats:
    rows = list(
        (
            await db.execute(
                select(GameScores)
                .where(GameScores.player_key == player_key)
                .order_by(GameScores.score.desc(), GameScores.id.desc())
                .limit(500)
            )
        )
        .scalars()
        .all()
    )
    if not rows:
        return PlayerStats(games_played=0, best_score=0, best_tile=0, total_moves=0)
    return PlayerStats(
        games_played=len(rows),
        best_score=max(row.score for row in rows),
        best_tile=max(row.best_tile for row in rows),
        total_moves=sum(row.moves for row in rows),
        last_played=_iso(max(rows, key=lambda row: row.id).created_at),
    )


@router.post("/sync", response_model=PlayerProfile)
async def sync_player(
    data: PlayerIdentity,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create or refresh the caller's player row and return personal stats."""
    user = await get_optional_user(request)
    player_key, is_guest, display_name = _resolve_identity(
        user, data.player_key, data.is_guest, data.display_name
    )
    if user is None and not _is_guest_key(player_key):
        raise HTTPException(status_code=400, detail="Invalid guest identity")
    player = await _upsert_player(db, player_key, display_name, is_guest)
    stats = await _stats_for(db, player_key)
    return PlayerProfile(
        player_key=player.player_key,
        display_name=player.display_name,
        is_guest=player.is_guest,
        stats=stats,
    )


def _is_guest_key(player_key: str) -> bool:
    return player_key.startswith(GUEST_PREFIX) and len(player_key) > len(GUEST_PREFIX)


@router.post("/scores", response_model=PlayerProfile)
async def submit_score(
    data: ScorePayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Store one finished game for the resolved player."""
    if not _is_power_of_two(data.best_tile):
        raise HTTPException(status_code=400, detail="best_tile must be a power of two")
    user = await get_optional_user(request)
    player_key, is_guest, display_name = _resolve_identity(
        user, data.player_key, True, ""
    )
    player = (
        await db.execute(select(GamePlayers).where(GamePlayers.player_key == player_key))
    ).scalar_one_or_none()
    if player is not None:
        display_name = player.display_name
    record = GameScores(
        player_key=player_key,
        display_name=display_name,
        score=data.score,
        best_tile=data.best_tile,
        moves=data.moves,
        duration_seconds=data.duration_seconds,
        is_guest=is_guest,
    )
    db.add(record)
    await db.commit()
    player = await _upsert_player(db, player_key, display_name, is_guest)
    stats = await _stats_for(db, player_key)
    return PlayerProfile(
        player_key=player.player_key,
        display_name=player.display_name,
        is_guest=player.is_guest,
        stats=stats,
    )


@router.post("/rename", response_model=PlayerProfile)
async def rename_player(
    data: RenamePayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Rename the current player (guest or account) without touching past scores."""
    user = await get_optional_user(request)
    player_key, is_guest, display_name = _resolve_identity(
        user, data.player_key, True, data.display_name
    )
    player = await _upsert_player(db, player_key, display_name, is_guest)
    await db.execute(
        GameScores.__table__.update()
        .where(GameScores.player_key == player_key)
        .values(display_name=display_name)
    )
    await db.commit()
    stats = await _stats_for(db, player_key)
    return PlayerProfile(
        player_key=player.player_key,
        display_name=player.display_name,
        is_guest=player.is_guest,
        stats=stats,
    )


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def leaderboard(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
):
    """Best single game per player, highest first."""
    rows = list(
        (
            await db.execute(select(GameScores).order_by(GameScores.score.desc()).limit(400))
        )
        .scalars()
        .all()
    )
    best: dict[str, GameScores] = {}
    for row in rows:
        if row.player_key not in best:
            best[row.player_key] = row
    ordered = sorted(best.values(), key=lambda row: row.score, reverse=True)[:limit]
    items = [
        LeaderboardRow(
            rank=index + 1,
            player_key=row.player_key,
            display_name=row.display_name,
            score=row.score,
            best_tile=row.best_tile,
            moves=row.moves,
            is_guest=row.is_guest,
            achieved_at=_iso(row.created_at),
        )
        for index, row in enumerate(ordered)
    ]
    return LeaderboardResponse(items=items, total=len(best))


@router.get("/history", response_model=ScoreHistoryResponse)
async def score_history(
    request: Request,
    db: AsyncSession = Depends(get_db),
    player_key: str = Query(..., min_length=4, max_length=120),
    limit: int = Query(10, ge=1, le=50),
):
    """Recent finished games for the resolved player."""
    user = await get_optional_user(request)
    resolved_key, _, _ = _resolve_identity(user, player_key, True, "")
    rows = list(
        (
            await db.execute(
                select(GameScores)
                .where(GameScores.player_key == resolved_key)
                .order_by(GameScores.id.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return ScoreHistoryResponse(
        items=[
            ScoreHistoryRow(
                id=row.id,
                score=row.score,
                best_tile=row.best_tile,
                moves=row.moves,
                duration_seconds=row.duration_seconds,
                created_at=_iso(row.created_at),
            )
            for row in rows
        ],
        total=len(rows),
    )