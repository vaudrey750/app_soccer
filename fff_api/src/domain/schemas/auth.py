from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class TenantSignupRequest(BaseModel):
    """
    Payload reçu du formulaire de création de compte SaaS.
    Correspond à l'écran 'Créer un compte'.
    """
    # Informations Utilisateur
    full_name: str = Field(..., min_length=2, description="Nom complet (ex: John Doe)")
    email: EmailStr = Field(..., description="Email professionnel")
    password: str = Field(..., min_length=8, description="Mot de passe")
    
    # Informations Club (Tenant)
    # Dans l'image, si 'Lier à un club FFF' est coché, l'utilisateur cherche un club.
    # On attend donc soit un ID FFF valide, soit juste un nom si création manuelle.
    is_fff_linked: bool = Field(default=False, description="Coché si 'Lier à un club officiel FFF'")
    club_name: str = Field(..., min_length=2, description="Nom du club saisi ou sélectionné")
    fff_real_club_id: Optional[str] = Field(default=None, description="ID FFF si liaison activée (ex: 549123)")

class Token(BaseModel):
    access_token: str
    token_type: str

class SignupResponse(BaseModel):
    tenant_id: str
    user_id: str
    message: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserInfo(BaseModel):
    id: str
    email: str
    full_name: str
    role: str # To interpret from Member link

class TenantInfo(BaseModel):
    id: str
    name: str
    slug: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserInfo
    tenant: Optional[TenantInfo] = None

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
