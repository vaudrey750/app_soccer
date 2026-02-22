from typing import List, Optional
import uuid
from sqlmodel import Field, SQLModel, UniqueConstraint, Relationship

# Formations
class Formation(SQLModel, table=True):
    __tablename__ = "formation"
    __table_args__ = {"schema": "core"}
    id: int = Field(primary_key=True, description="ID unique de la formation")
    name: str = Field(max_length=50, description="Nom de la formation (ex: 4-4-2)")
    category: Optional[str] = Field(default=None, max_length=50, description="Catégorie (Attaque, Équilibre, Défense)")
    description: Optional[str] = Field(default=None, description="Description textuelle")
    
    positions: List["FormationPosition"] = Relationship(back_populates="formation")

class FormationPosition(SQLModel, table=True):
    __tablename__ = "formation_position"
    __table_args__ = (
        UniqueConstraint("formation_id", "coord_x", "coord_y", name="uq_fmt_pos_coords"),
        {"schema": "core"}
    )
    id: int = Field(primary_key=True, description="ID unique de la position")
    formation_id: int = Field(foreign_key="core.formation.id", description="Lien vers la formation")
    role: str = Field(max_length=1, description="Rôle générique (G, D, M, F)")
    coord_x: float = Field(description="Position X en % (0-100)")
    coord_y: float = Field(description="Position Y en % (0-100)")
    position_label: str = Field(max_length=10, description="Label court (GK, CB...)")
    priority: int = Field(default=0, description="Priorité d'affichage/remplissage (plus petit = plus prioritaire)")
    
    formation: Optional[Formation] = Relationship(back_populates="positions")

class MatchLineup(SQLModel, table=True):
    __tablename__ = "match_lineup"
    __table_args__ = {"schema": "core"}
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique de l'entrée lineup")
    tenant_id: uuid.UUID = Field(foreign_key="saas.tenant.id", description="Club contextuel")
    event_id: uuid.UUID = Field(foreign_key="core.event.id", description="Match concerné")
    
    formation_id: int = Field(foreign_key="core.formation.id", description="Formation utilisée")
    position_id: int = Field(foreign_key="core.formation_position.id", description="Position dans la formation")
    
    member_id: uuid.UUID = Field(foreign_key="core.member.id", description="Joueur aligné")
