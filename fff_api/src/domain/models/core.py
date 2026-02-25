import uuid
from datetime import datetime, date
from typing import Optional, Dict, Any, List
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import JSON, Column, UniqueConstraint

class MemberRole(SQLModel, table=True):
    __tablename__ = "member_role"
    __table_args__ = {"schema": "core"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique du rôle")
    name: str = Field(default='MEMBER', max_length=50, unique=True, description="Nom du rôle système (ADMIN, COACH, MEMBER)")

class Member(SQLModel, table=True):
    __tablename__ = "member"
    __table_args__ = {"schema": "core"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique du membre")
    tenant_id: uuid.UUID = Field(foreign_key="saas.tenant.id", description="Club auquel appartient ce membre")
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="saas.users.id", description="Lien vers le compte utilisateur (si accès app)")
    
    first_name: str = Field(max_length=100, description="Prénom")
    last_name: str = Field(max_length=100, description="Nom de famille")
    email: Optional[str] = Field(default=None, max_length=255, description="Email de contact (peut différer du User)")
    phone: Optional[str] = Field(default=None, max_length=20, description="Numéro de téléphone")
    
    # Address
    address: Optional[str] = Field(default=None, max_length=255, description="Adresse (Rue)")
    city: Optional[str] = Field(default=None, max_length=100, description="Ville")
    postal_code: Optional[str] = Field(default=None, max_length=20, description="Code postal")
    country: Optional[str] = Field(default=None, max_length=100, description="Pays")
    
    role_in_app: Optional[uuid.UUID] = Field(default=None, foreign_key="core.member_role.id", description="Rôle global dans l'application")
    photo_url: Optional[str] = Field(default=None, description="Photo de profil")

    # Administrative
    medical_certificate_date: Optional[date] = Field(default=None, description="Date du dernier certificat médical")
    contribution_status: Optional[str] = Field(default="UNPAID", max_length=20, description="Statut cotisation (UNPAID, PARTIAL, PAID)")
    clothing_size: Optional[str] = Field(default=None, max_length=10, description="Taille équipements (S, M, L...)")



class PlayerPosition(SQLModel, table=True):
    __tablename__ = "player_position"
    __table_args__ = {"schema": "core"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique du poste")
    name: Optional[str] = Field(default=None, max_length=50, unique=True, description="Nom du poste (GOALKEEPER, DEFENDER...)")
    code: Optional[str] = Field(default=None, max_length=10, description="Code court (GK, DEF...)")

class TeamMember(SQLModel, table=True):
    __tablename__ = "team_member"
    __table_args__ = {"schema": "core"}
    team_id: uuid.UUID = Field(foreign_key="reference.team.id", primary_key=True, description="Lien vers l'équipe")
    member_id: uuid.UUID = Field(foreign_key="core.member.id", primary_key=True, description="Lien vers le membre")
    
    role: Optional[str] = Field(default=None, max_length=50, description="Rôle dans l'équipe (COACH, PLAYER)")
    jersey_number: Optional[int] = Field(default=None, description="Numéro de maillot")
    strong_foot: Optional[str] = Field(default=None, max_length=10, description="Pied fort (LEFT, RIGHT, BOTH)")
    season: Optional[str] = Field(default=None, foreign_key="reference.season.name", description="Saison concernée")
    position_id: Optional[uuid.UUID] = Field(default=None, foreign_key="core.player_position.id", description="Poste actuel dans cette équipe")

class EventType(SQLModel, table=True):
    __tablename__ = "event_type"
    __table_args__ = {"schema": "core"}
    id: int = Field(primary_key=True, description="ID unique type événement")
    name: Optional[str] = Field(default=None, max_length=50, unique=True, description="Code type (GAME, TRAINING, MEETING)")

class Events(SQLModel, table=True):
    __tablename__ = "event"
    __table_args__ = {"schema": "core"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique de l'événement")
    tenant_id: uuid.UUID = Field(foreign_key="saas.tenant.id", description="Club organisateur")
    
    type: int = Field(foreign_key="core.event_type.id", description="Type d'événement")
    status_id: int = Field(default=1, foreign_key="core.game_status.id", description="Statut de l'événement (SCHEDULED, CANCELLED...)")
    title: Optional[str] = Field(default=None, max_length=255, description="Titre affiché dans le calendrier")
    start_date: datetime = Field(description="Date et heure de début")
    end_date: Optional[datetime] = Field(default=None, description="Date et heure de fin")
    location: Optional[str] = Field(default=None, max_length=255, description="Lieu (adresse ou nom stade)")
    description: Optional[str] = Field(default=None, description="Description ou notes internes")
    
    game_id: Optional[uuid.UUID] = Field(default=None, foreign_key="reference.game.id", description="Lien vers le match si type=GAME")

    # Choix officiel Homme du Match par le staff (utilisé uniquement en cas de 0 vote ou d'égalité)
    coach_motm_member_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="core.member.id",
        description="Membre sélectionné par le coach en cas d'égalité/aucun vote",
    )
    
    lineup_published: bool = Field(default=False, description="Composition publiée aux joueurs")

    created_at: Optional[datetime] = Field(default_factory=datetime.now, description="Date de création")

    carpools: List["Carpool"] = Relationship(back_populates="event")

class GameStatus(SQLModel, table=True):
    __tablename__ = "game_status"
    __table_args__ = {"schema": "core"}
    id: int = Field(primary_key=True, description="ID statut match")
    name: Optional[str] = Field(default=None, max_length=50, unique=True, description="Code statut (SCHEDULED, PLAYED, POSTPONED)")

class ParticipationStatus(SQLModel, table=True):
    __tablename__ = "participation_status"
    __table_args__ = {"schema": "core"}
    id: int = Field(primary_key=True, description="ID statut présence")
    name: Optional[str] = Field(default=None, max_length=50, unique=True, description="Code statut (PENDING, CONFIRMED, DECLINED)")

class EventParticipation(SQLModel, table=True):
    __tablename__ = "event_participation"
    __table_args__ = {"schema": "core"}
    event_id: uuid.UUID = Field(foreign_key="core.event.id", primary_key=True, description="Lien vers l'événement")
    member_id: uuid.UUID = Field(foreign_key="core.member.id", primary_key=True, description="Lien vers le membre")
    tenant_id: uuid.UUID = Field(foreign_key="saas.tenant.id", description="Club contextuel")
    
    status: Optional[int] = Field(default=1, foreign_key="core.participation_status.id", description="État de la réponse")
    comment: Optional[str] = Field(default=None, description="Commentaire du membre (ex: 'Raison absence')")
    rating: Optional[float] = Field(default=None, description="Note du coach (0-10)")
    motm_votes: int = Field(default=0, description="Nombre de votes Homme du Match reçus")
    created_at: Optional[datetime] = Field(default_factory=datetime.now, description="Date création")
    updated_at: Optional[datetime] = Field(default=None, description="Date dernière maj")


class MotmVote(SQLModel, table=True):
    __tablename__ = "motm_vote"
    __table_args__ = (
        UniqueConstraint("event_id", "voter_member_id", name="uq_motm_vote_event_voter"),
        {"schema": "core"},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique du vote MotM")
    event_id: uuid.UUID = Field(foreign_key="core.event.id", description="Événement concerné")
    voter_member_id: uuid.UUID = Field(foreign_key="core.member.id", description="Membre qui vote")
    voted_member_id: uuid.UUID = Field(foreign_key="core.member.id", description="Membre voté (joueur)")
    created_at: Optional[datetime] = Field(default_factory=datetime.now, description="Date du vote")

class GameActionType(SQLModel, table=True):
    __tablename__ = "game_action_type"
    __table_args__ = {"schema": "core"}
    id: int = Field(primary_key=True, description="ID type action")
    name: Optional[str] = Field(default=None, max_length=50, unique=True, description="Code action (GOAL, YELLOW_CARD...)")

class GameTimeline(SQLModel, table=True):
    __tablename__ = "game_timeline"
    __table_args__ = {"schema": "core"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID fait de match")
    game_id: Optional[uuid.UUID] = Field(default=None, foreign_key="reference.game.id", description="Match concerné")
    tenant_id: uuid.UUID = Field(foreign_key="saas.tenant.id", description="Club contextuel")
    
    main_home_player_id: Optional[uuid.UUID] = Field(default=None, foreign_key="core.member.id", description="Joueur domicile concerné")
    assisting_home_player_id: Optional[uuid.UUID] = Field(default=None, foreign_key="core.member.id", description="Passeur domicile (si but)")
    main_away_player_id: Optional[uuid.UUID] = Field(default=None, foreign_key="core.member.id", description="Joueur extérieur concerné")
    assisting_away_player_id: Optional[uuid.UUID] = Field(default=None, foreign_key="core.member.id", description="Passeur extérieur (si but)")
    minute: Optional[int] = Field(default=None, description="Minute de l'action")
    action_type_id: Optional[int] = Field(default=None, foreign_key="core.game_action_type.id", description="Type d'action")
    extra_data: Dict[str, Any] = Field(default={}, sa_column=Column(JSON), description="Métadonnées supplémentaires")

class TaskType(SQLModel, table=True):
    __tablename__ = "task_type"
    __table_args__ = {"schema": "core"}
    id: int = Field(primary_key=True, description="ID type de tâche")
    name: Optional[str] = Field(default=None, max_length=50, unique=True, description="Nom catégoriel (CARPOOL, LAUNDRY...)")

class Task(SQLModel, table=True):
    __tablename__ = "task"
    __table_args__ = {"schema": "core"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique de la tâche")
    tenant_id: uuid.UUID = Field(foreign_key="saas.tenant.id", description="Club contextuel")
    event_id: Optional[uuid.UUID] = Field(default=None, foreign_key="core.event.id", description="Lien événement (si tâche liée à match/entrainement)")
    
    type_id: Optional[int] = Field(default=None, foreign_key="core.task_type.id", description="Catégorie de la tâche")
    
    assigned_member_id: Optional[uuid.UUID] = Field(default=None, foreign_key="core.member.id", description="Membre responsable")
    description: str = Field(description="Description de ce qu'il faut faire")
    is_completed: Optional[bool] = Field(default=False, description="État réalisation")

class Carpool(SQLModel, table=True):
    __tablename__ = "carpool"
    __table_args__ = {"schema": "core"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    event_id: uuid.UUID = Field(foreign_key="core.event.id")
    driver_id: uuid.UUID = Field(foreign_key="core.member.id")
    available_seats: int = Field(default=4)
    departure_location: Optional[str] = Field(default=None, max_length=255)
    departure_time: Optional[str] = Field(default=None, max_length=5) # HH:MM
    note: Optional[str] = Field(default=None)
    created_at: Optional[datetime] = Field(default_factory=datetime.now)

    event: "Events" = Relationship(back_populates="carpools")
    driver: "Member" = Relationship(sa_relationship_kwargs={"foreign_keys": "Carpool.driver_id"})
    passengers: List["CarpoolPassenger"] = Relationship(back_populates="carpool")

class CarpoolPassenger(SQLModel, table=True):
    __tablename__ = "carpool_passenger"
    __table_args__ = {"schema": "core"}
    carpool_id: uuid.UUID = Field(foreign_key="core.carpool.id", primary_key=True)
    member_id: uuid.UUID = Field(foreign_key="core.member.id", primary_key=True)
    created_at: Optional[datetime] = Field(default_factory=datetime.now)
    
    carpool: "Carpool" = Relationship(back_populates="passengers")
    member: "Member" = Relationship()

class MatchChat(SQLModel, table=True):
    __tablename__ = "match_chat"
    __table_args__ = {"schema": "core"}
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique du message")
    game_id: uuid.UUID = Field(foreign_key="reference.game.id", description="Match concerné")
    tenant_id: uuid.UUID = Field(foreign_key="saas.tenant.id", description="Club contextuel")
    
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="saas.users.id", description="Auteur (User)")
    member_id: Optional[uuid.UUID] = Field(default=None, foreign_key="core.member.id", description="Auteur (Member) optionnel")
    sender_name: str = Field(max_length=100, description="Nom affiché de l'auteur")
    
    message: str = Field(description="Contenu du message")
    created_at: Optional[datetime] = Field(default_factory=datetime.now, description="Date d'envoi")
    is_hidden: Optional[bool] = Field(default=False, description="Masqué par modération")


