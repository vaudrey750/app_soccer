import yaml
import os
from typing import Dict, Any

def load_config(config_path: str = "config.yaml") -> Dict[str, Any]:
    """
    Load configuration from a YAML file.
    """
    # Check if we are in the container, path might be relative to /app
    if not os.path.exists(config_path):
        # Try looking one level up if valid
        if os.path.exists(os.path.join("..", config_path)):
            config_path = os.path.join("..", config_path)
    
    # Final check
    if not os.path.exists(config_path):
        # Fallback empty config or raise error
        return {}

    with open(config_path, "r") as f:
        return yaml.safe_load(f)

def get_sync_schedule():
    config = load_config()
    return config.get("worker", {}).get("sync_schedule", {"day_of_week": "mon", "hour": 3, "minute": 0})
