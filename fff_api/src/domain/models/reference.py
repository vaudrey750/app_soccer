import uuid
from datetime import date, datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, UniqueConstraint, Relationship

class Season(SQLModel, table=True):
    __tablename__ = "season"
    __table_args__ = {"schema": "reference"}
    name: str = Field(max_length=50, primary_key=True, description="Nom de la season (ex: \"2025-2026\")")
    start_date: Optional[date] = Field(default=None, description="Date de début officielle")
    end_date: Optional[date] = Field(default=None, description="Date de fin officielle")
    is_active: Optional[bool] = Field(default=False, description="Indique si c'est la season courante active")

class Federation(SQLModel, table=True):
    __tablename__ = "federation"
    __table_args__ = {"schema": "reference"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique de la fédération")
    real_federation_id: Optional[str] = Field(default=None, max_length=50, description="ID externe de la fédération (ex: API FFF)")
    name: str = Field(max_length=255, description="Nom complet (ex: Fédération Française de Football)")
    short_name: Optional[str] = Field(default=None, max_length=100, description="Diminutif (ex: FFF)")
    country_code: Optional[str] = Field(default="FR", max_length=10, description="Code pays ISO (ex: FR)")
    
    leagues: List["League"] = Relationship(back_populates="federation")

class League(SQLModel, table=True):
    __tablename__ = "league"
    __table_args__ = {"schema": "reference"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique de la ligue")
    real_league_id: Optional[str] = Field(default=None, max_length=50, unique=True, description="ID externe de la ligue")
    federation_id: Optional[uuid.UUID] = Field(default=None, foreign_key="reference.federation.id", description="Fédération de rattachement")
    name: str = Field(max_length=255, description="Nom de la ligue (ex: Ligue Auvergne-Rhône-Alpes)")
    created_at: Optional[datetime] = Field(default_factory=datetime.now, description="Date d'ajout")

    federation: Optional[Federation] = Relationship(back_populates="leagues")
    competitions: List["Competition"] = Relationship(back_populates="league")
    clubs: List["Club"] = Relationship(back_populates="league")

class Competition(SQLModel, table=True):
    __tablename__ = "competition"
    __table_args__ = {"schema": "reference"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique de la compétition")
    real_competition_id: Optional[str] = Field(default=None, max_length=50, description="ID externe de la compétition")
    league_id: Optional[uuid.UUID] = Field(default=None, foreign_key="reference.league.id", description="Ligue organisatrice")
    name: str = Field(max_length=255, description="Nom de la compétition (ex: Seniors D1)")

    league: Optional[League] = Relationship(back_populates="competitions")
    games: List["Game"] = Relationship(back_populates="competition")

class Club(SQLModel, table=True):
    __tablename__ = "club"
    __table_args__ = {"schema": "reference"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique interne du club")
    tenant_id: Optional[uuid.UUID] = Field(default=None, foreign_key="saas.tenant.id", description="Lien optionnel si ce club reference devient un client SaaS")
    real_club_id: Optional[str] = Field(default=None, max_length=50, unique=True, description="Numéro d'affiliation ou ID unique externe")
    league_id: Optional[uuid.UUID] = Field(default=None, foreign_key="reference.league.id", description="Ligue principale")
    name: str = Field(max_length=255, description="Nom officiel du club")
    short_name: Optional[str] = Field(default=None, max_length=100, description="Nom court")
    president_first_name: Optional[str] = Field(default=None, max_length=100, description="Prénom du président")
    president_last_name: Optional[str] = Field(default=None, max_length=100, description="Nom du président")
    president_email: Optional[str] = Field(default=None, max_length=255, description="Email du président")
    city: Optional[str] = Field(default=None, max_length=100, description="Ville du siège")
    zipcode: Optional[str] = Field(default=None, max_length=20, description="Code postal")
    logo_url: Optional[str] = Field(default=None, description="URL du logo")
    affiliation_number: Optional[str] = Field(default=None, max_length=50, description="Numéro d'affiliation fédérale")
    is_claimed: Optional[bool] = Field(default=False, description="Vrai si ce club de référence est lié à un Tenant (revendiqué)")

    league: Optional["League"] = Relationship(back_populates="clubs")
    teams: List["Team"] = Relationship(back_populates="club")
    games_home: List["Game"] = Relationship(sa_relationship_kwargs={"foreign_keys": "Game.home_club_id"}, back_populates="home_club")
    games_away: List["Game"] = Relationship(sa_relationship_kwargs={"foreign_keys": "Game.away_club_id"}, back_populates="away_club")

class Team(SQLModel, table=True):
    __tablename__ = "team"
    __table_args__ = (
        UniqueConstraint("name", "category", "code", "number", name="uq_team_name_category_code_number"),
        {"schema": "reference"}
    )
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique de l'équipe")
    tenant_id: Optional[uuid.UUID] = Field(default=None, foreign_key="saas.tenant.id", description="Club propriétaire (SaaS)")
    club_id: Optional[uuid.UUID] = Field(default=None, foreign_key="reference.club.id", description="Club de référence (FFF)")
    season: Optional[str] = Field(foreign_key="reference.season.name", description="Saison de validité de l'équipe")
    
    code: Optional[int] = Field(default=None, description="Code type de l'équipe (1, 2...)")
    number: Optional[int] = Field(default=None, description="Numéro unique de l'équipe (API eq_no)")
    name: str = Field(max_length=100, description="Nom court (ex: U15 B)")
    gender: Optional[str] = Field(default='M', max_length=10, description="Genre (M, F, MIXED)")
    category: Optional[str] = Field(default=None, max_length=255, description="Category Label (ex: Senior Libre)")

    club: Optional["Club"] = Relationship(back_populates="teams")
    games_home: List["Game"] = Relationship(sa_relationship_kwargs={"foreign_keys": "Game.home_team_id"}, back_populates="home_team")
    games_away: List["Game"] = Relationship(sa_relationship_kwargs={"foreign_keys": "Game.away_team_id"}, back_populates="away_team")

class Game(SQLModel, table=True):
    __tablename__ = "game"
    __table_args__ = (
        UniqueConstraint("data_hash", "tenant_id", name="uq_game_data_hash_tenant"),
        {"schema": "reference"}
    )
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID match (hérite fonctionnellement de events)")
    timer_start_at: Optional[datetime] = Field(default=None, description="Début du chrono serveur (LIVE)")
    elapsed_time_at_start: Optional[int] = Field(default=0, description="Temps cumulé start (secondes)")

    competition_id: Optional[uuid.UUID] = Field(default=None, foreign_key="reference.competition.id", description="Compétition concernée")
    tenant_id: Optional[uuid.UUID] = Field(default=None, foreign_key="saas.tenant.id", description="Club concerné (si applicable)")
    
    journee: Optional[int] = Field(default=None, description="Numéro de la journée")

    home_club_id: Optional[uuid.UUID] = Field(default=None, foreign_key="reference.club.id", description="Club domicile (Reference)")
    home_team_id: Optional[uuid.UUID] = Field(default=None, foreign_key="reference.team.id", description="Lien équipe domicile (si interne/connue)")
    home_team_name: Optional[str] = Field(default=None, max_length=255, description="Nom équipe domicile (texte libre/scrapé)")
    score_home: Optional[int] = Field(default=None, description="Score domicile")
    home_penalty_score: Optional[int] = Field(default=None, description="Score tirs au but domicile")
    home_is_forfeit: Optional[bool] = Field(default=False, description="Forfait domicile ?")

    away_club_id: Optional[uuid.UUID] = Field(default=None, foreign_key="reference.club.id", description="Club extérieur (Reference)")
    away_team_id: Optional[uuid.UUID] = Field(default=None, foreign_key="reference.team.id", description="Lien équipe extérieur (si interne/connue)")
    away_team_name: Optional[str] = Field(default=None, max_length=255, description="Nom équipe extérieur (texte libre/scrapé)")
    score_away: Optional[int] = Field(default=None, description="Score extérieur")
    away_penalty_score: Optional[int] = Field(default=None, description="Score tirs au but extérieur")
    away_is_forfeit: Optional[bool] = Field(default=False, description="Forfait extérieur ?")

    possession_home: Optional[int] = Field(default=None, description="Possession de balle domicile (%)")

    date_match: Optional[date] = Field(default=None, description="Date du match")
    date_time: Optional[str] = Field(default=None, max_length=5, description="Heure du match (HH:MM)")
    seems_postponed: Optional[bool] = Field(default=False, description="Flag auto: semble reporté (scraping)")
    
    status: Optional[int] = Field(default=None, foreign_key="core.game_status.id", description="Statut global du match")
    data_hash: Optional[str] = Field(default=None, max_length=64, description="Hash pour détection de changements (scraping)")
    season: Optional[str] = Field(default=None, foreign_key="reference.season.name", description="Saison du match")
    address: Optional[str] = Field(default=None, max_length=255, description="Adresse du stade")
    zip_code: Optional[str] = Field(default=None, max_length=20, description="Code postal du stade")
    city: Optional[str] = Field(default=None, max_length=100, description="Ville du stade")
    stadium: Optional[str] = Field(default=None, max_length=255, description="Nom du stade")

    phase_number: Optional[int] = Field(default=None, description="Numéro de phase")
    phase_name: Optional[str] = Field(default=None, max_length=100, description="Nom de la phase")
    poule_stage_number: Optional[int] = Field(default=None, description="Numéro d'étape/poule")
    poule_name: Optional[str] = Field(default=None, max_length=100, description="Nom de la poule")

    # Chat Control
    is_chat_closed: bool = Field(default=False, description="Indique si le chat du match est fermé")
    chat_closed_at: Optional[datetime] = Field(default=None, description="Date de fermeture du chat")

    # Timer Fields
    current_period: Optional[int] = Field(default=1, description="Période actuelle (1: 1ère mi-temps, 2: 2ème mi-temps, 3: Prolongation 1, 4: Prolongation 2)")
    timer_start_at: Optional[datetime] = Field(default=None, description="Timestamp de démarrage du chrono pour la période actuelle")
    elapsed_time_at_start: Optional[int] = Field(default=0, description="Temps écoulé (en secondes) avant le dernier démarrage du chrono")

    competition: Optional["Competition"] = Relationship(back_populates="games")
    home_club: Optional["Club"] = Relationship(sa_relationship_kwargs={"foreign_keys": "Game.home_club_id"}, back_populates="games_home")
    away_club: Optional["Club"] = Relationship(sa_relationship_kwargs={"foreign_keys": "Game.away_club_id"}, back_populates="games_away")
    home_team: Optional["Team"] = Relationship(sa_relationship_kwargs={"foreign_keys": "Game.home_team_id"}, back_populates="games_home")
    away_team: Optional["Team"] = Relationship(sa_relationship_kwargs={"foreign_keys": "Game.away_team_id"}, back_populates="games_away")
