from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
import uuid
import logging

from src.infrastructure.database.session import get_session
from src.domain.schemas.auth import TenantSignupRequest, SignupResponse, Token, LoginRequest, LoginResponse, UserInfo, TenantInfo, ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest
from src.domain.models.saas import Tenant, User
from src.domain.models.reference import Club
from src.domain.models.core import Member, MemberRole
from src.domain.models.job import ImportJob, JobStatus
from src.core.security import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM

from jose import JWTError, jwt

# Logger
logger = logging.getLogger(__name__)

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/saas/token")

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session)
):
    # 1. Authenticate User
    stmt = select(User).where(User.email == form_data.username)
    res = await session.execute(stmt)
    user = res.scalars().first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 2. Find associated Tenant (via Member)
    # Basic assumption: User belongs to 1 main tenant (the one he is admin of)
    # For now, we fetch the first membership.
    stmt_member = select(Member).where(Member.user_id == user.id)
    res_member = await session.execute(stmt_member)
    member = res_member.scalars().first()
    
    tenant_id_str = str(member.tenant_id) if member else None
    
    # 3. Create Token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "tid": tenant_id_str, "uid": str(user.id)},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=LoginResponse)
async def login_json_endpoint(
    login_data: LoginRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Endpoint de login JSON standard pour le frontend.
    Retourne le Token + Infos User/Context.
    """
    # 1. Authenticate
    stmt = select(User).where(User.email == login_data.email)
    res = await session.execute(stmt)
    user = res.scalars().first()
    
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Get Context (Member -> Tenant)
    stmt_member = select(Member, MemberRole).join(
        MemberRole, Member.role_in_app == MemberRole.id, isouter=True
    ).where(Member.user_id == user.id)
    
    res = await session.execute(stmt_member)
    row = res.first()
    
    member = None
    role_name = "MEMBER"
    tenant_info = None


    if row:
        member, role_obj = row
        if role_obj:
             role_name = role_obj.name
             
        if member:
            tenant = await session.get(Tenant, member.tenant_id)
            if tenant:
                 tenant_info = TenantInfo(
                     id=str(tenant.id), 
                     name=tenant.name, 
                     slug=tenant.slug
                 )

    # 3. Create Token
    tid_str = str(tenant_info.id) if tenant_info else None
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "tid": tid_str, "uid": str(user.id)},
        expires_delta=access_token_expires
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserInfo(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name or "",
            role=role_name,
        ),
        tenant=tenant_info
    )




async def get_current_user_context(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        tid: str = payload.get("tid")
        if email is None or tid is None:
            raise credentials_exception
        return {"email": email, "tenant_id": tid}
    except JWTError:
        raise credentials_exception

@router.post("/me/password", status_code=status.HTTP_200_OK)
async def change_password(
    password_data: ChangePasswordRequest,
    context: dict = Depends(get_current_user_context),
    session: AsyncSession = Depends(get_session)
):
    """
    Change le mot de passe de l'utilisateur connecté.
    """
    email = context["email"]
    
    # 1. Fetch User
    stmt = select(User).where(User.email == email)
    res = await session.execute(stmt)
    user = res.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        
    # 2. Verify Old
    if not verify_password(password_data.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="L'ancien mot de passe est incorrect")
        
    # 3. Update
    user.password_hash = get_password_hash(password_data.new_password)
    session.add(user)
    await session.commit()
    
    return {"message": "Mot de passe mis à jour avec succès"}

@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    payload: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Déclenche le processus de réinitialisation de mot de passe.
    Génère un token et (simule) l'envoi d'un email.
    """
    stmt = select(User).where(User.email == payload.email)
    res = await session.execute(stmt)
    user = res.scalars().first()

    if not user:
        # Pour éviter l'énumération des emails, on répond toujours OK
        # sauf si on veut être explicite en dev
        return {"message": "Si cet email existe, un lien de réinitialisation a été envoyé."}

    # 1. Générer un token reset (court terme, ex: 15min)
    expires = timedelta(minutes=15)
    reset_token = create_access_token(
        data={"sub": user.email, "type": "reset_password"},
        expires_delta=expires
    )

    # 2. "Envoyer" l'email (Simulation Log)
    reset_link = f"https://app.fmkiller.com/reset-password?token={reset_token}"
    logger.info(f"[EMAIL MOCK] Password Reset for {user.email}: {reset_link}")

    return {"message": "Si cet email existe, un lien de réinitialisation a été envoyé."}

@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    payload: ResetPasswordRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Utilise le token reçu par email pour définir un nouveau mot de passe.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Token invalide ou expiré"
    )

    # 1. Verify Token
    try:
        data = jwt.decode(payload.token, SECRET_KEY, algorithms=[ALGORITHM])
        email = data.get("sub")
        token_type = data.get("type")
        
        if not email or token_type != "reset_password":
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception

    # 2. Get User
    stmt = select(User).where(User.email == email)
    res = await session.execute(stmt)
    user = res.scalars().first()

    if not user:
        raise credentials_exception

    # 3. Update Password
    user.password_hash = get_password_hash(payload.new_password)
    session.add(user)
    await session.commit()

    return {"message": "Votre mot de passe a été réinitialisé avec succès. Vous pouvez vous connecter."}

@router.get("/tenants/{slug_or_id}", response_model=TenantInfo)
async def get_tenant_public_info(
    slug_or_id: str,
    session: AsyncSession = Depends(get_session)
):
    """
    Récupère les infos publiques d'un Tenant par son ID ou Slug.
    Utilisé par le sélecteur de tenant pour valider la connexion ou l'affichage public.
    """
    # 1. Try by Slug (Common case)
    stmt = select(Tenant).where(Tenant.slug == slug_or_id)
    res = await session.execute(stmt)
    tenant = res.scalars().first()
    
    # 2. Try by ID if not found and looks like UUID
    if not tenant:
        try:
            val_uuid = uuid.UUID(slug_or_id)
            tenant = await session.get(Tenant, val_uuid)
        except ValueError:
            pass
            
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trouvé")
        
    return TenantInfo(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug
    )

@router.post("/sync", status_code=202)
async def sync_tenant_data(
    context: dict = Depends(get_current_user_context),
    session: AsyncSession = Depends(get_session)
):
    """
    Déclenche une synchronisation des données FFF pour le club connecté.
    Nécessite d'être authentifié.
    """
    tenant_id = context["tenant_id"]
    
    # 1. Fetch Tenant to get real_club_id
    # We need uuid
    try:
        t_uuid = uuid.UUID(tenant_id)
        tenant = await session.get(Tenant, t_uuid)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Tenant ID in token")
        
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if not tenant.real_club_id:
        raise HTTPException(
            status_code=400, 
            detail="Ce compte n'est pas lié à un club FFF. Veuillez contacter le support pour lier votre club."
        )

    # 2. Create ImportJob
    # We create a JOB with Type=UPDATE (or IMPORT) specifically for this user.
    # We must ensure the worker is ready. The Worker reads ImportJob.
    # ImportConfig schema: { "club_id": 123, "label": "My Club" }
    
    # Convert '542312' str to int if needed by your worker schema, but DB stores str? 
    # Checking import_config.py... field is 'club_id: int'.
    try:
        cid_int = int(tenant.real_club_id)
    except:
        raise HTTPException(status_code=500, detail="Identifiant FFF malformé dans la base.")

    config = {
        "club_id": cid_int,
        "label": tenant.name
    }

    job = ImportJob(
        configs=[config],
        status=JobStatus.PENDING,
        # Potentially add a 'created_by_tenant' field later
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    
    logger.info(f"Tenant {tenant.name} ({tenant.id}) triggered sync job #{job.id}")

    return {
        "message": "Synchronisation lancée avec succès. Vos données seront à jour dans quelques minutes.",
        "job_id": job.id
    }

@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant_account(
    signup_data: TenantSignupRequest, 
    session: AsyncSession = Depends(get_session)
):
    """
    Crée un nouveau compte Tenant + Utilisateur Admin.
    Correspond au formulaire 'Créer un compte'.
    """
    
    # 1. Vérifier si l'email existe déjà
    stmt = select(User).where(User.email == signup_data.email)
    res = await session.execute(stmt)
    if res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet email est déjà utilisé."
        )

    # 2. Créer le Tenant (Organisation)
    # Génération du slug basique (à améliorer pour prod avec unicity check)
    clean_name = signup_data.club_name.lower().replace(" ", "-").replace("'", "")
    new_slug = f"{clean_name}-{uuid.uuid4().hex[:4]}" 
    
    # Gestion du lien FFF
    real_id = signup_data.fff_real_club_id if signup_data.is_fff_linked else None

    # Check if this FFF club is already claimed by another tenant?
    if real_id:
        stmt_dup = select(Tenant).where(Tenant.real_club_id == real_id)
        res_dup = await session.execute(stmt_dup)
        if res_dup.scalars().first():
             raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Le club FFF {real_id} est déjà géré par un autre espace."
            )
            
        # President Verification
        stmt_ref_club = select(Club).where(Club.real_club_id == real_id)
        res_ref_club = await session.execute(stmt_ref_club)
        ref_club = res_ref_club.scalars().first()

        if ref_club and ref_club.president_email:
             # Normalize emails
             official_email = ref_club.president_email.lower().strip()
             signup_email = signup_data.email.lower().strip()
             
             if official_email != signup_email:
                 # Check if partial match or domain match could be allowed? 
                 # For now, strict security as requested.
                 raise HTTPException(
                     status_code=status.HTTP_403_FORBIDDEN,
                     detail="Sécurité : Seul le président officiel peut revendiquer ce club. Veuillez utiliser l'adresse email officielle connue de la FFF ou contacter le support."
                 )

    new_tenant = Tenant(
        name=signup_data.club_name,
        slug=new_slug,
        real_club_id=real_id
    )
    session.add(new_tenant)
    await session.flush() # Pour avoir l'ID

    # 3. Créer l'Utilisateur
    hashed_pwd = get_password_hash(signup_data.password)
    new_user = User(
        email=signup_data.email,
        full_name=signup_data.full_name,
        password_hash=hashed_pwd
    )
    session.add(new_user)
    await session.flush()

    # 4. Créer le Membre (Lien User <-> Tenant) et lui donner le rôle ADMIN
    # D'abord, on cherche ou crée le rôle ADMIN
    stmt_role = select(MemberRole).where(MemberRole.name == "ADMIN")
    res_role = await session.execute(stmt_role)
    admin_role = res_role.scalars().first()
    
    if not admin_role:
        # Initialisation lazy des rôles si db vide
        admin_role = MemberRole(name="ADMIN")
        session.add(admin_role)
        await session.flush()

    # Split name for Member fields (basic split)
    parts = signup_data.full_name.split(" ", 1)
    fname = parts[0]
    lname = parts[1] if len(parts) > 1 else ""

    new_member = Member(
        tenant_id=new_tenant.id,
        user_id=new_user.id,
        first_name=fname,
        last_name=lname,
        email=signup_data.email,
        role_in_app=admin_role.id
    )
    session.add(new_member)
    
    await session.commit()
    
    # 5. Si lié à un club FFF, déclencher l'import initial pour peupler/réclamer les données
    if real_id:
        try:
            cid_int = int(real_id)
            config = {
                "club_id": cid_int,
                "label": new_tenant.name
            }
            # Note: Le worker verra que le Tenant "claim" ce club ID et mettra à jour les tenant_id
            job = ImportJob(
                configs=[config],
                status=JobStatus.PENDING
            )
            session.add(job)
            await session.commit()
            logger.info(f"Initial sync job #{job.id} triggered for new tenant {new_tenant.name}")
        except Exception as e:
            logger.error(f"Failed to trigger initial sync for tenant {new_tenant.name}: {e}")
            # On ne bloque pas la création de compte pour ça, mais on log l'erreur

    return SignupResponse(
        tenant_id=str(new_tenant.id),
        user_id=str(new_user.id),
        message="Compte créé avec succès."
    )
