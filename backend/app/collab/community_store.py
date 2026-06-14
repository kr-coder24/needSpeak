"""In-memory community grouping for hackathon bulk-buy matching."""

from __future__ import annotations

from app.collab.models import CommunityGroup

_communities: dict[str, CommunityGroup] = {}


def normalize_community_code(value: str) -> str:
    return "".join(ch for ch in value.strip().upper() if ch.isalnum() or ch in {"-", "_"})


def join_community(session_id: str, community_code: str, community_name: str = "") -> CommunityGroup | None:
    code = normalize_community_code(community_code)
    if not code:
        return None

    group = _communities.get(code)
    if not group:
        group = CommunityGroup(code=code, name=community_name.strip() or code)
        _communities[code] = group
    elif community_name.strip() and group.name == group.code:
        group.name = community_name.strip()

    if session_id not in group.member_session_ids:
        group.member_session_ids.append(session_id)
    return group


def get_community(code: str) -> CommunityGroup | None:
    return _communities.get(normalize_community_code(code))


def list_communities() -> list[CommunityGroup]:
    return sorted(_communities.values(), key=lambda group: group.created_at, reverse=True)


def get_community_sessions(code: str) -> list[str]:
    group = get_community(code)
    return list(group.member_session_ids) if group else []


def clear_communities_for_tests() -> None:
    _communities.clear()
