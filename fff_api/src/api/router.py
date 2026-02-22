from fastapi import APIRouter
from src.api.v1.endpoints import saas, reference, core, sport, tasks, carpooling, match_status

api_router = APIRouter()
api_router.include_router(saas.router, prefix="/saas", tags=["SaaS"])
api_router.include_router(reference.router, prefix="/reference", tags=["Reference"])
api_router.include_router(core.router, prefix="/core", tags=["Core"])
api_router.include_router(sport.router, prefix="/sport", tags=["Sport"])
api_router.include_router(match_status.router, prefix="/sport", tags=["Sport"]) # Added this
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(carpooling.router, prefix="/carpooling", tags=["Carpooling"])
