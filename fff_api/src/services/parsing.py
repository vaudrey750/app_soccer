import logging
import asyncio
from datetime import datetime
from typing import List, Dict, Any

from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.storage.minio import MinioStorageService
from src.infrastructure.database.session import engine
from src.domain.schemas.import_config import ImportConfig
from src.domain.models import core, saas
from src.domain.models.reference import Team, Club
from sqlalchemy import select, and_

# Parsers
from src.services.parsers.club import ClubParser
from src.services.parsers.competition import CompetitionParser
from src.services.parsers.team import TeamParser
from src.services.parsers.game import GameParser

# Processors
from src.services.processors.base import ReferenceProcessor
from src.services.processors.club_processor import ClubProcessor
from src.services.processors.competition_processor import CompetitionProcessor
from src.services.processors.team_processor import TeamProcessor
from src.services.processors.game_processor import GameProcessor

logger = logging.getLogger(__name__)

class ParsingWorkflow:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.minio = MinioStorageService()
        self.date_str = datetime.now().strftime("%Y-%m-%d")
        
        # Processors
        self.ref_processor = ReferenceProcessor(session)
        self.club_processor = ClubProcessor(session)
        self.comp_processor = CompetitionProcessor(session)
        self.team_processor = TeamProcessor(session)
        self.game_processor = GameProcessor(session)

    async def run(self, configs: List[ImportConfig]):
        # 1. Ensure Reference Data
        status_map = await self.ref_processor.ensure_defaults()
        fff_id = await self.ref_processor.get_fff_federation_id()
        season_name = self.ref_processor.get_current_season_name()

        # Preload Global Team Map for linking opponents
        global_team_map = await self.team_processor.preload_global_map(season_name)

        for config in configs:
            try:
                await self._process_single_config(
                    config, 
                    fff_id, 
                    season_name, 
                    status_map, 
                    global_team_map
                )
            except Exception as e:
                logger.error(f"Error parsing club {config.club_id}: {e}", exc_info=True)
        
        await self.session.commit()

    async def _process_single_config(self, 
                                   config: ImportConfig, 
                                   fff_id: int, 
                                   season_name: str, 
                                   status_map: Dict[str, int],
                                   global_team_map: Dict[str, str]):
        
        cid = config.club_id
        logger.info(f"Parsing data for club {cid} ({config.label})...")

        # Paths 
        path_club = f"raw/clubs/{self.date_str}/{cid}/club_info.json"
        path_comp = f"raw/clubs/{self.date_str}/{cid}/competitions.json"
        path_team = f"raw/clubs/{self.date_str}/{cid}/teams.json"
        path_match = f"raw/clubs/{self.date_str}/{cid}/matches.json"

        # 1. Club
        club_db = None
        if self.minio.file_exists(path_club):
            raw_club = self.minio.read_json(path_club)
            clubs = ClubParser(raw_club).parse()
            club_db = await self.club_processor.process_clubs(clubs, raw_club, fff_id)
        else:
            logger.warning(f"File not found: {path_club}")
            # If no club data, we might struggle with tenant_id logic later, be careful

        # 2. Competitions
        comp_map_db = {} # real_id -> uuid
        if self.minio.file_exists(path_comp):
            raw_comps = self.minio.read_json(path_comp)
            # Need list extraction for the raw map passed to processor
            if isinstance(raw_comps, dict) and "hydra:member" in raw_comps:
                raw_list = raw_comps["hydra:member"]
            elif isinstance(raw_comps, list):
                raw_list = raw_comps
            else:
                 raw_list = [raw_comps]

            comps = CompetitionParser(raw_comps).parse()
            comp_map_db = await self.comp_processor.process_competitions(comps, raw_list, fff_id)

        # 3. Teams
        comp_team_map = {} # cp_no (real_comp_id) -> our_team_uuid
        comp_team_codes_map = {} # cp_no -> {number, code}
        
        if self.minio.file_exists(path_team):
            raw_teams = self.minio.read_json(path_team)
            teams = TeamParser(raw_teams).parse()
            
            tenant_id = club_db.tenant_id if club_db else None
            c_uuid = club_db.id if club_db else None
            comp_team_map = await self.team_processor.process_teams(teams, tenant_id, c_uuid, season_name)
            
            # Map codes for accurate linking (number/code)
            for team in teams:
                 if hasattr(team, '_engagements') and team._engagements:
                    for eng in team._engagements:
                         if 'competition' in eng and 'cp_no' in eng['competition']:
                            cp_no_eng = str(eng['competition']['cp_no'])
                            comp_team_codes_map[cp_no_eng] = {
                                "number": team.number,
                                "code": team.code,
                                "short_name": team.name
                            }

        # 4. Matches
        if self.minio.file_exists(path_match):
            raw_matches = self.minio.read_json(path_match)
            
            # Flatten & Build Match->Comp Map (raw)
            # This is specific to the messy raw structure, so kept here or in parser?
            # Keeping here as "workflow logic"
            all_items = []
            if isinstance(raw_matches, list):
                for page in raw_matches:
                    if isinstance(page, dict):
                        all_items.extend(page.get("hydra:member", []))
            elif isinstance(raw_matches, dict):
                all_items.extend(raw_matches.get("hydra:member", []))
            
            match_raw_map = {}
            match_comp_map_raw = {}
            for it in all_items:
                if it.get("ma_no"):
                    ma_no = f'{str(it["ma_no"])}'
                    match_raw_map[ma_no] = it
                    if it.get("competition"):
                        match_comp_map_raw[ma_no] = str(it["competition"].get("cp_no"))
            
            if all_items:
                logger.info(f"Parsing {len(all_items)} matches for club {cid}")
                logger.info(f"Match Map Keys: {len(match_comp_map_raw)} keys. Sample: {list(match_comp_map_raw.keys())[:5]}")
                
                games = GameParser(all_items).parse()

                # --- 1. PRE-FETCH TEAMS ---
                # Resolve attributes for all teams involved (Home & Away) using DB
                needed_clubs = set()
                for game in games:
                     if game.data_hash in match_raw_map:
                        raw = match_raw_map[game.data_hash]
                        for side in ['home', 'away']:
                            d = raw.get(side) or {}
                            c = d.get('club') or {}
                            if c.get('cl_no'):
                                needed_clubs.add(str(c['cl_no']))
                
                team_lookup = {}
                if needed_clubs:
                    # Fetch basic team info for these clubs to allow linking opponents
                    stmt = select(Team.id, Team.number, Team.code, Club.real_club_id, Club.id.label("c_uuid"))\
                        .join(Club, Team.club_id == Club.id)\
                        .where(Club.real_club_id.in_(needed_clubs))
                    
                    res = await self.session.execute(stmt)
                    for row in res.all():
                        # Key: (cl_no, number, code)
                        r_code = str(row.code) if row.code is not None else None
                        r_num = str(row.number) if row.number is not None else None
                        key = (str(row.real_club_id), r_num, r_code)
                        team_lookup[key] = (row.id, row.c_uuid)

                # Enrich games with Competition ID and contextual Team IDs before processing
                for game in games:
                    # Link via hash (ma_no) -> raw map -> db map
                    if game.data_hash in match_comp_map_raw:
                        cp_real = match_comp_map_raw[game.data_hash]
                        
                        # 1. Link Competition
                        if cp_real in comp_map_db:
                            game.competition_id = comp_map_db[cp_real]
                            
                        # 2. Link Teams (Home & Away) via DB Lookup
                        # (Replaces the old "our_team" only logic)
                        if game.data_hash in match_raw_map:
                            raw_item = match_raw_map[game.data_hash]
                            
                            for prefix in ['home', 'away']:
                                data = raw_item.get(prefix) or {}
                                club_data = data.get('club') or {}
                                
                                cl_no = str(club_data.get('cl_no')) if club_data.get('cl_no') else None
                                
                                val_num = data.get('number')
                                nb = str(val_num) if val_num is not None else None
                                
                                val_code = data.get('code')
                                cd = str(val_code) if val_code is not None else None
                                
                                if cl_no and nb:
                                    found = team_lookup.get((cl_no, nb, cd))
                                    if found:
                                        tid, cid_uuid = found
                                        if prefix == 'home':
                                            game.home_team_id = tid
                                            game.home_club_id = cid_uuid
                                        else:
                                            game.away_team_id = tid
                                            game.away_club_id = cid_uuid
                    else:
                        logger.warning(f"Game Hash {game.data_hash} NOT in match_comp_map_raw")

                await self.game_processor.process_games(
                    games,
                    season_name,
                    comp_map_db,
                    comp_team_map,
                    global_team_map,
                    club_db,
                    status_map
                )

async def parse_club_data(configs: List[ImportConfig]):
    """
    Entry point that mimics the old function signature
    """
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        workflow = ParsingWorkflow(session)
        await workflow.run(configs)
