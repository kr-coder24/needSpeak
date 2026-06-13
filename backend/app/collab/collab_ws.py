from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)

class CollabConnectionManager:
    """Manages WebSocket connections grouped by collab session_id."""
    
    def __init__(self):
        # dict[session_id, list[dict{"websocket": WebSocket, "contributor_id": str}]]
        self.active_connections: dict[str, list[dict]] = {}

    async def connect(self, session_id: str, websocket: WebSocket, contributor_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append({
            "websocket": websocket,
            "contributor_id": contributor_id
        })
        logger.info(f"[WS] Client {contributor_id} connected to session {session_id}")

    def disconnect(self, session_id: str, websocket: WebSocket, contributor_id: str):
        if session_id in self.active_connections:
            # Filter out the disconnected websocket
            self.active_connections[session_id] = [
                conn for conn in self.active_connections[session_id] 
                if conn["websocket"] != websocket
            ]
            # Clean up empty sessions
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
        logger.info(f"[WS] Client {contributor_id} disconnected from session {session_id}")

    async def broadcast(self, session_id: str, message: dict):
        """Send message to all clients in a session."""
        if session_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[session_id]:
                try:
                    await connection["websocket"].send_json(message)
                except Exception as e:
                    logger.warning(f"[WS] Error sending message to {connection['contributor_id']}: {e}")
                    dead_connections.append(connection)
            
            # Remove any connections that failed
            for dead in dead_connections:
                self.active_connections[session_id].remove(dead)

# Global instance
manager = CollabConnectionManager()
