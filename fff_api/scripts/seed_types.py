import asyncio
import logging
from sqlmodel import Session, select
from src.infrastructure.database.session import engine
from src.domain.models.core import MemberRole, PlayerPosition, EventType, GameStatus, ParticipationStatus, GameActionType, TaskType

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_data():
    async with engine.begin() as conn:
         # For async usage, we rely on executing statements directly or using AsyncSession
         from sqlalchemy.orm import sessionmaker
         from sqlmodel.ext.asyncio.session import AsyncSession
         
         async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
         )
         
         async with async_session() as session:
            # EventType
            event_types = {
                1: "MATCH", 
                2: "ENTRAÎNEMENT", 
                3: "RÉUNION",
                4: "TOURNOI",
                5: "SOCIAL",
                6: "AUTRE"
            }
            for id, name in event_types.items():
                result = await session.exec(select(EventType).where(EventType.id == id))
                obj = result.first()
                if not obj:
                    session.add(EventType(id=id, name=name))
                    logger.info(f"Added EventType: {name}")
                elif obj.name != name:
                    obj.name = name
                    session.add(obj)
                    logger.info(f"Updated EventType: {name}")

            # GameStatus
            game_statuses = {
                1: "SCHEDULED", 
                2: "PLAYED", 
                3: "POSTPONED", 
                4: "CANCELLED", 
                5: "LIVE",
                6: "HALFTIME",
                7: "AWAITING_REPORT",
                8: "ABANDONED",
                9: "FORFEITED",
                10: "DELAYED",
            }
            for id, name in game_statuses.items():
                result = await session.exec(select(GameStatus).where(GameStatus.id == id))
                obj = result.first()
                if not obj:
                    # Check if name collision exists with different ID
                    name_check = await session.exec(select(GameStatus).where(GameStatus.name == name))
                    existing = name_check.first()
                    if existing:
                        logger.warning(f"GameStatus name collision for {name}. Existing ID: {existing.id}, New ID: {id}. Updating existing to match new ID scheme or Skipping.")
                        # Strategy: Delete old and insert new to enforce ID scheme? Or skip?
                        # Let's Skip/Update safely.
                    else:
                        session.add(GameStatus(id=id, name=name))
                        logger.info(f"Added GameStatus: {name}")

            # ParticipationStatus
            part_statuses = {
                1: "PENDING", # En attente (User hasn't responded)
                2: "CONFIRMED", # Présent (User confirmed)
                3: "DECLINED", # Absent (User declined)
                4: "EXCUSED", # Excusé (User declined with reason)
                5: "NO_RESPONSE", # Sans réponse
                6: "SELECTED", # Sélectionné/Convoqué (Coach selected them)
            }
            for id, name in part_statuses.items():
                result = await session.exec(select(ParticipationStatus).where(ParticipationStatus.id == id))
                obj = result.first()
                if not obj:
                    session.add(ParticipationStatus(id=id, name=name))
                    logger.info(f"Added ParticipationStatus: {name}")

            # GameActionType
            action_types = {
                1: "BUT",  # GOAL
                2: "CARTON_JAUNE",  # YELLOW_CARD
                3: "CARTON_ROUGE",  # RED_CARD
                4: "REMPLACEMENT",  # SUBSTITUTION
                5: "CONTRE_SON_CAMP",  # OWN_GOAL
                6: "PÉNALTY_MANQUÉ",  # PENALTY_MISSED
                7: "PÉNALTY_MARQUÉ",  # PENALTY_SCORED
                8: "BLESSURE",  # INJURY
                9: "HORS_JEU",  # OFFSIDE
                10: "FAUTE",  # FOUL
                11: "CORNER",  # CORNER
                12: "COUP_FRANC",  # FREE_KICK
                13: "COUP_D_ENVOI",  # KICK_OFF
                14: "MI_TEMPS",  # HALF_TIME
                15: "FIN_DU_MATCH",  # FULL_TIME
                16: "REPRISE_SECONDE_MI_TEMPS",  # SECOND_HALF_KICK_OFF
                17: "FAIT_DE_JEU",  # HIGHLIGHT/NOTE
                18: "POSSESSION",  # BALL POSSESSION
                99: "STATS"  # STATS
            }
            for id, name in action_types.items():
                result = await session.exec(select(GameActionType).where(GameActionType.id == id))
                obj = result.first()
                if not obj:
                    session.add(GameActionType(id=id, name=name))
                    logger.info(f"Added GameActionType: {name}")

            # TaskType
            task_types = {
                1: "COVOITURAGE", 
                2: "BLANCHISSERIE", 
                3: "COLLATION",
                4: "VÉRIFICATION_DU_MATÉRIEL",
                5: "INSTALLATION_DU_TERRAIN",
                6: "NETTOYAGE_DU_TERRAIN",
                7: "AUTRES"
            }
            for id, name in task_types.items():
                result = await session.exec(select(TaskType).where(TaskType.id == id))
                obj = result.first()
                if not obj:
                    session.add(TaskType(id=id, name=name))
                    logger.info(f"Added TaskType: {name}")

            # MemberRole
            roles = [
                "MEMBER",
                "ADMIN", 
                "COACH", 
                "PARENT", 
                "MANAGER", 
                "VOLUNTEER", 
                "STAFF",
                "GUEST"
            ]
            for name in roles:
                result = await session.exec(select(MemberRole).where(MemberRole.name == name))
                obj = result.first()
                if not obj:
                    session.add(MemberRole(name=name))
                    logger.info(f"Added MemberRole: {name}")
            
            # PlayerPosition
            positions = {
                "GARDIEN": "GB",
                "DEFENSEUR CENTRAL": "DC",
                "LATÉRAL DROIT": "DD",
                "LATÉRAL GAUCHE": "DG",
                "MILIEU OFFENSIF": "MOC",
                "MILIEU DÉFENSIF": "MDC",
                "MILIEU CENTRAL": "MC",
                "AILIER DROIT": "AD",
                "AILIER GAUCHE": "AG",
                "BUTEUR": "BU"
            }
            for name, code in positions.items():
                result = await session.exec(select(PlayerPosition).where(PlayerPosition.name == name))
                obj = result.first()
                if not obj:
                    session.add(PlayerPosition(name=name, code=code))
                    logger.info(f"Added PlayerPosition: {name} ({code})")
                else:
                    if not obj.code:
                        obj.code = code
                        session.add(obj)
                        logger.info(f"Updated PlayerPosition code: {name} -> {code}")

            await session.commit()
            logger.info("Seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed_data())
