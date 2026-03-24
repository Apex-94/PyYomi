from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, Literal

from app.extensions.base import BaseScraper

GlobalSearchSourceStatus = Literal["pending", "running", "complete", "failed", "timed_out"]


@dataclass
class GlobalSearchSourceState:
    source_id: str
    source_name: str
    status: GlobalSearchSourceStatus = "pending"
    result_count: int = 0
    results: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None


@dataclass
class GlobalSearchSession:
    session_id: str
    query: str
    page: int
    source_order: list[str]
    sources: dict[str, GlobalSearchSourceState]
    done: bool = False
    completed_order: list[str] = field(default_factory=list)
    created_at: float = field(default_factory=time.monotonic)
    completed_at: float | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    task: asyncio.Task[None] | None = None


class GlobalSearchSessionManager:
    def __init__(
        self,
        *,
        max_concurrency: int = 6,
        per_source_timeout: float = 8.0,
        ttl_seconds: float = 300.0,
    ) -> None:
        self.max_concurrency = max_concurrency
        self.per_source_timeout = per_source_timeout
        self.ttl_seconds = ttl_seconds
        self._sessions: Dict[str, GlobalSearchSession] = {}
        self._lock = asyncio.Lock()

    async def create_session(
        self,
        query: str,
        page: int,
        source_items: Iterable[tuple[str, BaseScraper]],
    ) -> dict[str, Any]:
        await self.cleanup_expired()

        source_pairs = list(source_items)
        session_id = uuid.uuid4().hex
        source_order = [source_id for source_id, _ in source_pairs]
        sources = {
            source_id: GlobalSearchSourceState(source_id=source_id, source_name=scraper.name)
            for source_id, scraper in source_pairs
        }
        session = GlobalSearchSession(
            session_id=session_id,
            query=query,
            page=page,
            source_order=source_order,
            sources=sources,
            done=not source_pairs,
            completed_at=time.monotonic() if not source_pairs else None,
        )

        async with self._lock:
            self._sessions[session_id] = session

        initial_snapshot = await self._snapshot(session)

        if source_pairs:
            session.task = asyncio.create_task(self._run_session(session_id, source_pairs))

        return initial_snapshot

    async def get_snapshot(self, session_id: str) -> dict[str, Any]:
        await self.cleanup_expired()
        session = await self._get_session(session_id)
        if not session:
            raise KeyError(session_id)
        return await self._snapshot(session)

    async def cleanup_expired(self) -> None:
        now = time.monotonic()
        async with self._lock:
            expired = [
                session_id
                for session_id, session in self._sessions.items()
                if session.done and session.completed_at is not None and (now - session.completed_at) > self.ttl_seconds
            ]
            for session_id in expired:
                self._sessions.pop(session_id, None)

    async def _get_session(self, session_id: str) -> GlobalSearchSession | None:
        async with self._lock:
            return self._sessions.get(session_id)

    async def _run_session(
        self,
        session_id: str,
        source_items: list[tuple[str, BaseScraper]],
    ) -> None:
        session = await self._get_session(session_id)
        if not session:
            return

        semaphore = asyncio.Semaphore(self.max_concurrency)
        query = session.query
        page = session.page

        async def run_source(source_id: str, scraper: BaseScraper) -> None:
            async with semaphore:
                await self._mark_running(session_id, source_id)
                try:
                    cards = await asyncio.wait_for(
                        scraper.search(query, page, filters=None),
                        timeout=self.per_source_timeout,
                    )
                    results = self._normalize_results(source_id, cards)
                    await self._mark_terminal(
                        session_id,
                        source_id,
                        status="complete",
                        results=results,
                        error=None,
                    )
                except asyncio.TimeoutError:
                    await self._mark_terminal(
                        session_id,
                        source_id,
                        status="timed_out",
                        results=[],
                        error="Search timed out",
                    )
                except Exception as exc:
                    await self._mark_terminal(
                        session_id,
                        source_id,
                        status="failed",
                        results=[],
                        error=str(exc) or exc.__class__.__name__,
                    )

        await asyncio.gather(*(run_source(source_id, scraper) for source_id, scraper in source_items))

        session = await self._get_session(session_id)
        if not session:
            return
        async with session.lock:
            if not session.done:
                session.done = True
                session.completed_at = time.monotonic()

    async def _mark_running(self, session_id: str, source_id: str) -> None:
        session = await self._get_session(session_id)
        if not session:
            return
        async with session.lock:
            source = session.sources[source_id]
            source.status = "running"
            source.error = None

    async def _mark_terminal(
        self,
        session_id: str,
        source_id: str,
        *,
        status: Literal["complete", "failed", "timed_out"],
        results: list[dict[str, Any]],
        error: str | None,
    ) -> None:
        session = await self._get_session(session_id)
        if not session:
            return

        async with session.lock:
            source = session.sources[source_id]
            source.status = status
            source.results = results
            source.result_count = len(results)
            source.error = error
            if source_id not in session.completed_order:
                session.completed_order.append(source_id)

            if all(
                item.status in {"complete", "failed", "timed_out"}
                for item in session.sources.values()
            ):
                session.done = True
                session.completed_at = time.monotonic()

    async def _snapshot(self, session: GlobalSearchSession) -> dict[str, Any]:
        async with session.lock:
            completed_ids = list(session.completed_order)
            remaining_ids = [source_id for source_id in session.source_order if source_id not in completed_ids]
            ordered_ids = completed_ids + remaining_ids
            ordered_sources = [session.sources[source_id] for source_id in ordered_ids]

            pending_sources = sum(source.status == "pending" for source in ordered_sources)
            running_sources = sum(source.status == "running" for source in ordered_sources)
            completed_sources = sum(source.status == "complete" for source in ordered_sources)
            failed_sources = sum(source.status == "failed" for source in ordered_sources)
            timed_out_sources = sum(source.status == "timed_out" for source in ordered_sources)

            return {
                "session_id": session.session_id,
                "query": session.query,
                "page": session.page,
                "done": session.done,
                "total_sources": len(session.source_order),
                "pending_sources": pending_sources,
                "running_sources": running_sources,
                "completed_sources": completed_sources,
                "failed_sources": failed_sources,
                "timed_out_sources": timed_out_sources,
                "sources": [
                    {
                        "source_id": source.source_id,
                        "source_name": source.source_name,
                        "status": source.status,
                        "result_count": source.result_count,
                        "results": source.results,
                        "error": source.error,
                    }
                    for source in ordered_sources
                ],
            }

    def _normalize_results(self, source_id: str, cards: Iterable[Any]) -> list[dict[str, Any]]:
        seen_urls: set[str] = set()
        normalized: list[dict[str, Any]] = []

        for card in cards:
            payload = card.__dict__.copy()
            url = str(payload.get("url") or "").strip()
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            payload["source"] = payload.get("source") or source_id
            normalized.append(payload)

        return normalized


global_search_sessions = GlobalSearchSessionManager()
