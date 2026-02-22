from typing import List
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from src.domain.schemas.import_config import ImportConfig
from src.infrastructure.database.session import init_db
from src.api.router import api_router
from src.application.use_cases.trigger_import import TriggerImportUseCase
from src.api.dependencies import get_trigger_import_use_case
import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialise DB on startup
    await init_db()
    yield

app = FastAPI(title="FFF Scraper API", lifespan=lifespan)

# Ajout du middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://192.168.1.169:5173"], # Autoriser le frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "FFF Scraper API is running"}

@app.post("/import-clubs", status_code=202)
async def trigger_import(
    configs: List[ImportConfig], 
    use_case: TriggerImportUseCase = Depends(get_trigger_import_use_case)
):
    """
    Triggers the import process for the provided list of club configurations.
    The process is queued as a job for the worker to pick up.
    """
    try:
        job = await use_case.execute(configs)
    except ValueError as e:
         raise HTTPException(status_code=400, detail=str(e))
    
    logger.info(f"Job {job.id} created with {len(configs)} configs.")
    
    return {
        "message": f"Import job queued for {len(configs)} clubs", 
        "job_id": job.id, 
        "status": job.status
    }
