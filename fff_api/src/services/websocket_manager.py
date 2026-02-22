from typing import Dict, List, Set
from fastapi import WebSocket
import asyncio
import json

class ConnectionManager:
    def __init__(self):
        # Map game_id to list of active websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Map game_id to set of active queues for SSE
        self.active_streams: Dict[str, Set[asyncio.Queue]] = {}

    async def connect(self, websocket: WebSocket, game_id: str):
        await websocket.accept()
        if game_id not in self.active_connections:
            self.active_connections[game_id] = []
        self.active_connections[game_id].append(websocket)

    def disconnect(self, websocket: WebSocket, game_id: str):
        if game_id in self.active_connections:
            if websocket in self.active_connections[game_id]:
                self.active_connections[game_id].remove(websocket)
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]
                
    # --- SSE Logic ---
    async def connect_stream(self, game_id: str) -> asyncio.Queue:
        if game_id not in self.active_streams:
            self.active_streams[game_id] = set()
        queue = asyncio.Queue()
        self.active_streams[game_id].add(queue)
        return queue
        
    def disconnect_stream(self, game_id: str, queue: asyncio.Queue):
        if game_id in self.active_streams:
            if queue in self.active_streams[game_id]:
                self.active_streams[game_id].remove(queue)
            if not self.active_streams[game_id]:
                del self.active_streams[game_id]

    # --- Broadcast ---
    async def broadcast(self, game_id: str, message: dict):
        json_msg = message
        # Convert to string for WS if needed (but send_json does it)
        # For SSE: We need string format "data: ...\n\n"
        sse_msg = f"data: {json.dumps(message)}\n\n"
        
        print(f"Broadcasting to game {game_id}: {message}") # DEBUG LOG

        # 1. WebSockets
        if game_id in self.active_connections:
            # Copy list to avoid modification during iteration if disconnects happen
            count = len(self.active_connections[game_id])
            print(f"Found {count} active WS connections") # DEBUG LOG
            for connection in self.active_connections[game_id][:]:
                try:
                    await connection.send_json(json_msg)
                except Exception as e:
                    print(f"WS Error: {e}")
                    # Handle broken pipe or disconnect
                    self.disconnect(connection, game_id)
        
        # 2. SSE Streams
        if game_id in self.active_streams:
            # Broadcast to queues
            count = len(self.active_streams[game_id])
            print(f"Found {count} active SSE streams") # DEBUG LOG
            for queue in list(self.active_streams[game_id]):
                try:
                    await queue.put(sse_msg)
                except Exception as e:
                    print(f"SSE Queue Error: {e}")
                    pass

manager = ConnectionManager()
