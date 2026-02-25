import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlmodel import Field, SQLModel
from sqlalchemy import JSON, Column

class Plan(SQLModel, table=True):
    __tablename__ = "plan"
    __table_args__ = {"schema": "saas"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique du plan d'abonnement")
    name: str = Field(max_length=100, unique=True, description="Nom commercial du plan (ex: \"Start\", \"Pro\")")
    stripe_price_id: Optional[str] = Field(default=None, max_length=100, description="Identifiant du prix correspondant dans Stripe")
    price_monthly: Optional[float] = Field(default=None, description="Prix mensuel du plan") # DECIMAL(10, 2)
    features: Dict[str, Any] = Field(default={}, sa_column=Column(JSON), description="Liste des fonctionnalités incluses (JSON) (ex: {\"stats\": true})")

class Tenant(SQLModel, table=True):
    __tablename__ = "tenant"
    __table_args__ = {"schema": "saas"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique du locataire (Club)")
    name: str = Field(max_length=255, unique=True, description="Nom affiché du club ou de l'organisation")
    slug: str = Field(max_length=100, unique=True, index=True, description="Identifiant unique pour l'URL (ex: monclub.subdomain.com)")
    
    # Link to external data source (FFF)
    real_club_id: Optional[str] = Field(default=None, unique=True, index=True, description="ID officiel FFF du club (pour mapping auto)")

    # Branding
    primary_color: Optional[str] = Field(default=None, max_length=7, description="Code couleur principal (Hex)")
    logo_url: Optional[str] = Field(default=None, description="URL du logo du club")
    
    # Billing
    stripe_customer_id: Optional[str] = Field(default=None, max_length=100, unique=True, description="Identifiant client Stripe pour la facturation")

    # Settings
    active_season_name: Optional[str] = Field(
        default=None,
        max_length=50,
        foreign_key="reference.season.name",
        description="Saison active sélectionnée pour ce club (référence Season.name)",
    )
    
    created_at: Optional[datetime] = Field(default_factory=datetime.now, description="Date de création du compte")

class Subscription(SQLModel, table=True):
    __tablename__ = "subscription"
    __table_args__ = {"schema": "saas"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique de l'abonnement")
    tenant_id: uuid.UUID = Field(foreign_key="saas.tenant.id", description="Clé étrangère vers le Tenant abonné")
    plan_id: uuid.UUID = Field(foreign_key="saas.plan.id", description="Clé étrangère vers le Plan souscrit")
    stripe_subscription_id: Optional[str] = Field(default=None, max_length=100, unique=True, description="Identifiant de l'abonnement côté Stripe")
    status: Optional[str] = Field(default=None, max_length=50, description="État de l'abonnement ('active', 'past_due', etc.)")
    current_period_end: Optional[datetime] = Field(default=None, description="Date de fin de la période de facturation courante")

class User(SQLModel, table=True):
    __tablename__ = "users"
    __table_args__ = {"schema": "saas"}
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, description="ID unique de l'utilisateur")
    email: str = Field(max_length=255, unique=True, index=True, description="Adresse email de connexion")
    password_hash: str = Field(max_length=255, description="Hash du mot de passe sécurisé")
    full_name: Optional[str] = Field(default=None, max_length=255, description="Nom complet de l'utilisateur")
    created_at: Optional[datetime] = Field(default_factory=datetime.now, description="Date d'inscription")
