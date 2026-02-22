from typing import Dict

TEAM_CATEGORY_MAPPING: Dict[str, str] = {
    "Senior Libre": "Seniors",
    "U19": "U19",
    "U18": "U18",
    "U17": "U17",
    "U16": "U16",
    "U15": "U15",
    "U14": "U14",
    "U13": "U13",
    "U12": "U12",
    "U11": "U11",
    "U10": "U10",
    "U9": "U9",
    "U8": "U8",
    "U7": "U7",
    "U6": "U6",
    "Veterans": "Vétérans",
    "Loisir": "Loisir",
}

def get_readable_category(category_code: str) -> str:
    """
    Returns a readable category label for a given category code (or raw string).
    If no mapping is found, returns the original string.
    """
    if not category_code:
        return ""
    
    # Try exact match
    if category_code in TEAM_CATEGORY_MAPPING:
        return TEAM_CATEGORY_MAPPING[category_code]
        
    # Try partial match or normalization if needed?
    # For now, just return original
    return category_code
