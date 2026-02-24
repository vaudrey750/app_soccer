from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.infrastructure.database.session import get_session
from src.core.security import SECRET_KEY, ALGORITHM
from src.domain.models.saas import User
from src.domain.models.core import Member

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/saas/token")

async def get_db():
    async for session in get_session():
        yield session

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Executing select(User)
    stmt = select(User).where(User.email == email)
    result = await session.execute(stmt)
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> User:
    stmt_member = select(Member).where(
        Member.user_id == current_user.id,
        Member.is_access_blocked == True,  # noqa: E712
    )
    res_member = await session.execute(stmt_member)
    blocked = res_member.scalars().first()
    if blocked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès bloqué")
    return current_user
