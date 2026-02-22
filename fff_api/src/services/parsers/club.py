from typing import Any, List, Optional
from .base import BaseParser
from src.domain.models.reference import Club

class ClubParser(BaseParser[Club]):
    def parse(self) -> List[Club]:
        """
        Expects raw_data to be a dict (single club info) or list of dicts.
        """
        data = self.raw_data
        if isinstance(data, dict):
            # If it's a hydra:Collection or similar, check 'hydra:member'
            if "hydra:member" in data:
                data = data["hydra:member"]
            else:
                data = [data]
        
        clubs = []
        for item in data:
            # Handle potentially nested club structure if passing teams json directly?
            # But normally we pass club_info.json which IS the club object or a wrapper.
            
            # If item contains 'club' key, maybe we are parsing teams but extracting club?
            # Let's assume we parse the direct club object.
            
            # Mapping
            # Check if cl_no exists
            if not item.get("cl_no") and not item.get("affiliation_number"):
                continue

            pres_info = self._extract_president_info(item.get("membres", []))

            club = Club(
                real_club_id=str(item.get("cl_no")),
                name=item.get("name") or "Unknown Club",
                short_name=item.get("short_name"),
                logo_url=item.get("logo"),
                affiliation_number=str(item.get("affiliation_number")) if item.get("affiliation_number") else None,
                president_first_name=pres_info.get("first_name"),
                president_last_name=pres_info.get("last_name"),
                president_email=pres_info.get("email"),
                # league_id? Need to lookup League by cg_no. 
                # This is hard without DB access here. 
                # We usually leave foreign keys to be resolved or Upsert logic.
            )
            clubs.append(club)
            
        return clubs

    def _extract_president_info(self, members: List[dict]) -> dict:
        """
        Extracts president info (first_name, last_name, email).
        """
        info = {"first_name": None, "last_name": None, "email": None}
        if not members:
            return info

        president_member = None

        # Try to find strict PRESIDENT first
        for member in members:
            title = member.get("ti_lib", "").upper().strip()
            if title == "PRESIDENT" or title == "PRÉSIDENT":
                president_member = member
                break
        
        # If not found, maybe look for title containing PRESIDENT but usually explicit is better to avoid VICE PRESIDENT
        if not president_member:
            return info

        info["first_name"] = president_member.get("in_prenom")
        info["last_name"] = president_member.get("in_nom")
        
        individu = president_member.get("individu", {})
        contacts = individu.get("contacts", [])
        
        for contact in contacts:
            # EP = Email Principal
            if contact.get("co_typ_coor") == "EP" and contact.get("co_coor"):
                info["email"] = contact.get("co_coor")
                break
        
        return info
