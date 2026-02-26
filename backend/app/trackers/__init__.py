"""Tracker registry and loader"""
from typing import Dict, Optional
from .base import BaseTracker
from .myanimelist import MyAnimeListTracker
from .anilist import AniListTracker


class TrackerRegistry:
    """Registry for all available trackers"""
    
    _trackers: Dict[str, BaseTracker] = {}
    
    @classmethod
    def register(cls, tracker: BaseTracker) -> None:
        """Register a tracker instance"""
        cls._trackers[tracker.name] = tracker
    
    @classmethod
    def get(cls, name: str) -> Optional[BaseTracker]:
        """Get a tracker by name"""
        return cls._trackers.get(name)
    
    @classmethod
    def list_all(cls) -> Dict[str, BaseTracker]:
        """Get all registered trackers"""
        return cls._trackers.copy()


# Register trackers
TrackerRegistry.register(MyAnimeListTracker())
TrackerRegistry.register(AniListTracker())