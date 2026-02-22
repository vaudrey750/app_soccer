import httpx
import asyncio
import os

# Configuration
API_URL = "http://localhost:8000/api/v1"
# Login credentials (assuming seeded admin or use existing token logic if needed)
# For simplicity, we'll try to use a hardpoint test if auth is complex, 
# but let's try to mimic a real add_event call.

async def check_sse_broadcast():
    # 1. Get a game
    async with httpx.AsyncClient() as client:
        # Login first to get token
        login_res = await client.post(f"{API_URL}/auth/access-token", data={
            "username": "admin@fff.com", 
            "password": "admin"
        })
        
        if login_res.status_code != 200:
            print(f"Login failed: {login_res.text}")
            return

        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # List games to find one
        games_res = await client.get(f"{API_URL}/coach/games", headers=headers)
        if games_res.status_code != 200:
            print(f"Failed to list games: {games_res.text}")
            return
            
        games = games_res.json()
        if not games:
            print("No games found.")
            return

        game_id = games[0]["id"]
        print(f"Targeting Game ID: {game_id}")

        # 2. Add a timeline event to trigger broadcast
        # Payload matching TimelineEventCreate
        payload = {
            "minute": 15,
            "period": 1,
            "action_type_id": "GOAL", # Assuming this ID exists or is mapped
            "type": "GOAL",
            "comment": "Test SSE Trigger script",
            "player_id": None # Optional
        }
        
        # We need to know the endpoint structure. 
        # Based on file structure: /games/{game_id}/timeline
        res = await client.post(
            f"{API_URL}/games/{game_id}/timeline", 
            json=payload,
            headers=headers
        )
        
        if res.status_code in [200, 201]:
            print(f"Successfully added event to game {game_id}.")
            print("Check docker logs now for [BROADCAST] messages.")
        else:
            print(f"Failed to add event: {res.status_code} - {res.text}")

if __name__ == "__main__":
    asyncio.run(check_sse_broadcast())
