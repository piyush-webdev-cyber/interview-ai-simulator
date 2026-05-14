from fastapi import WebSocket


class WebSocketManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, set[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(session_id, set()).add(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        connections = self.active_connections.get(session_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self.active_connections.pop(session_id, None)

    async def broadcast(self, session_id: str, message: dict) -> None:
        for websocket in self.active_connections.get(session_id, set()).copy():
            await websocket.send_json(message)


websocket_manager = WebSocketManager()

