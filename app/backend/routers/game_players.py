import json
from datetime import date, datetime
from typing import Optional

from core.database import get_db
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from services.game_players import GamePlayersService
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/entities/game_players", tags=["game_players"])


class GamePlayersData(BaseModel):
    player_key: str
    display_name: str
    is_guest: bool


class GamePlayersUpdateData(BaseModel):
    player_key: Optional[str] = None
    display_name: Optional[str] = None
    is_guest: Optional[bool] = None


class GamePlayersResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    player_key: str
    display_name: str
    is_guest: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class GamePlayersListResponse(BaseModel):
    items: list[GamePlayersResponse]
    total: int
    skip: int
    limit: int


def parse_query(value: str | None) -> dict | None:
    if not value:
        return None
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid query JSON") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=400, detail="Query must be a JSON object")
    return parsed


@router.get("", response_model=GamePlayersListResponse)
async def query_items(
    query: str | None = Query(None),
    sort: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=2000),
    fields: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await GamePlayersService(db).get_list(
            skip=skip, limit=limit, query=parse_query(query), sort=sort, user_id=None
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/all", response_model=GamePlayersListResponse)
async def query_all_items(
    query: str | None = Query(None),
    sort: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=2000),
    fields: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await GamePlayersService(db).get_list(
            skip=skip, limit=limit, query=parse_query(query), sort=sort
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{item_id}", response_model=GamePlayersResponse)
async def get_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    item = await GamePlayersService(db).get_by_id(item_id, None)
    if item is None:
        raise HTTPException(status_code=404, detail="GamePlayers not found")
    return item


@router.post("", response_model=GamePlayersResponse, status_code=201)
async def create_item(
    data: GamePlayersData,
    db: AsyncSession = Depends(get_db),
):
    return await GamePlayersService(db).create(data.model_dump(exclude_unset=True), None)


@router.put("/{item_id}", response_model=GamePlayersResponse)
async def update_item(
    item_id: int,
    data: GamePlayersUpdateData,
    db: AsyncSession = Depends(get_db),
):
    item = await GamePlayersService(db).update(
        item_id, data.model_dump(exclude_unset=True), None
    )
    if item is None:
        raise HTTPException(status_code=404, detail="GamePlayers not found")
    return item


@router.delete("/{item_id}")
async def delete_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    deleted = await GamePlayersService(db).delete(item_id, None)
    if not deleted:
        raise HTTPException(status_code=404, detail="GamePlayers not found")
    return {"id": item_id, "deleted": True}
