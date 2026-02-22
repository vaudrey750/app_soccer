import asyncio
import logging
import sys
from sqlmodel import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from src.infrastructure.database.session import init_db, DATABASE_URL
from src.domain.models.job import ImportJob, JobStatus, JobType
from src.domain.models.reference import Club
from src.domain.schemas.import_config import ImportConfig
from src.services.ingestion import save_club_data_to_minio
from src.services.parsing import parse_club_data
from src.core.config import get_sync_schedule

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - [WORKER] - %(levelname)s - %(message)s')
logger = logging.getLogger("worker")

async def create_weekly_sync_job(engine):
    """
    Weekly task to create a job that updates ALL existing clubs in reference.
    """
    logger.info("Scheduler: Starting weekly sync job creation...")
    try:
        async_session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with async_session_factory() as session:
            # 1. Fetch all existing clubs
            stmt = select(Club)
            result = await session.execute(stmt)
            clubs = result.scalars().all()
            
            if not clubs:
                logger.info("Scheduler: No clubs in database to sync.")
                return

            # 2. Prepare configs
            configs = []
            for club in clubs:
                # Assuming cl_no or real_club_id logic. Here we use real_club_id as int if possible or handle conversion
                # ImportConfig expects club_id as int currently.
                try:
                    c_id = int(club.real_club_id) if club.real_club_id.isdigit() else 0
                    if c_id > 0:
                        configs.append({"club_id": c_id, "label": club.name})
                except Exception:
                    continue

            if configs:
                # 3. Create UPDATE Job
                job = ImportJob(
                    type=JobType.UPDATE,
                    configs=configs,
                    status=JobStatus.PENDING
                )
                session.add(job)
                await session.commit()
                logger.info(f"Scheduler: Successfully created Weekly Sync Job #{job.id} with {len(configs)} clubs.")
            else:
                logger.warning("Scheduler: Found clubs but failed to generate valid configs.")

    except Exception as e:
        logger.error(f"Scheduler Error: {e}")

async def process_jobs():
    logger.info("Worker started. Polling for jobs...")
    
    # Create a local engine for the worker process
    worker_engine = create_async_engine(DATABASE_URL, echo=False, future=True)

    # Initialize Scheduler
    scheduler = AsyncIOScheduler()
    
    # Load schedule from config.yaml
    schedule_config = get_sync_schedule()
    logger.info(f"Configuring Scheduler with: {schedule_config}")
    
    scheduler.add_job(
        create_weekly_sync_job, 
        CronTrigger(
            day_of_week=schedule_config.get('day_of_week', 'mon'),
            hour=schedule_config.get('hour', 3),
            minute=schedule_config.get('minute', 0)
        ), 
        args=[worker_engine]
    )
    
    scheduler.start()
    logger.info("Scheduler started.")
    
    while True:
        try:
            async_session = sessionmaker(worker_engine, class_=AsyncSession, expire_on_commit=False)
            
            async with async_session() as session:
                # Find the oldest pending job with row locking to prevent race conditions
                statement = (
                    select(ImportJob)
                    .where(ImportJob.status == JobStatus.PENDING)
                    .order_by(ImportJob.created_at)
                    .limit(1)
                    .with_for_update(skip_locked=True)
                )
                result = await session.execute(statement)
                job = result.scalars().first()
                
                if job:
                    logger.info(f"Processing Job #{job.id} (Type: {job.type})")
                    
                    # Mark as processing
                    job.status = JobStatus.PROCESSING
                    session.add(job)
                    await session.commit()
                    await session.refresh(job)
                    
                    try:
                        configs_to_process = []
                        skipped_clubs = []
                        
                        # Logic: Check existence for each requested club
                        for job_conf in job.configs:
                            cid = job_conf['club_id']
                            
                            # Only check for existence strictly if it's an IMPORT (Registration) job
                            # If it's an UPDATE job, we proceed regardless.
                            should_process = True
                            
                            if job.type == JobType.IMPORT:
                                logging.info(f"Checking existence of club {cid} for Registration...")
                                stmt = select(Club).where(Club.real_club_id == str(cid))
                                res = await session.execute(stmt)
                                existing_club = res.scalars().first()
                                
                                if existing_club:
                                    logging.info(f"Club {cid} ('{existing_club.name}') already exists. Proceeding with update/ingestion.")
                                else:
                                    logging.info(f"Club {cid} is new. Preparing for ingestion.")

                            if should_process:
                                configs_to_process.append(ImportConfig(**job_conf))

                        if configs_to_process:
                            # 1. Ingestion (MinIO)
                            logger.info(f"Step 1: Ingesting raw files for {len(configs_to_process)} clubs.")
                            successful_configs = await save_club_data_to_minio(configs=configs_to_process)
                            
                            if not successful_configs:
                                logger.warning(f"Job #{job.id}: No clubs were successfully ingested.")
                            
                            # 2. Register in DB (ONLY if new AND if ingestion succeeded)
                            # Update logic: If it's an update job, the club likely exists, so we might skip this 
                            # or use 'upsert'. For now, we only add if it's strictly new to avoid UniqueViolations.
                            logger.info("Step 2: verifying DB registration for successful clubs.")
                            
                            # Keep track of failed configs for potential retries (requested by user to fix missing files)
                            failed_config_ids = {c.club_id for c in configs_to_process} - {c.club_id for c in successful_configs}
                            if failed_config_ids:
                                logger.warning(f"Some clubs failed to ingest: {failed_config_ids}. They will NOT be registered/parsed.")

                            for conf in successful_configs:
                                stmt = select(Club).where(Club.real_club_id == str(conf.club_id))
                                res = await session.execute(stmt)
                                existing = res.scalars().first()
                                
                                if not existing:
                                    new_club = Club(
                                        real_club_id=str(conf.club_id), 
                                        name=conf.label, 
                                        short_name=conf.label,
                                        is_claimed=False
                                    )
                                    session.add(new_club)
                            await session.commit()
                            
                            # 3. Parsing (Only successful ones)
                            if successful_configs:
                                logger.info("Step 3: Parsing raw data.")
                                await parse_club_data(configs=successful_configs)
                            
                            # Set status based on results
                            if failed_config_ids:
                                job.error_message = f"Partially completed. Failed ingest: {failed_config_ids}. Skipped existing: {skipped_clubs}"
                            elif skipped_clubs:
                                job.error_message = f"Partially completed. Skipped existing clubs: {skipped_clubs}"
                            
                            job.status = JobStatus.COMPLETED
                            logger.info(f"Job #{job.id} completed successfully.")
                            
                        else:
                            # 0 configs to process
                            if skipped_clubs:
                                logger.info(f"Job #{job.id} skipped - All clubs already exist.")
                                job.status = JobStatus.COMPLETED 
                                job.error_message = f"Skipped: All clubs already exist {skipped_clubs}"
                            else:
                                logger.warning(f"Job #{job.id} had no valid configs.")
                                job.status = JobStatus.FAILED
                                job.error_message = "No configs provided"

                    except Exception as e:
                        logger.error(f"Job #{job.id} failed: {e}", exc_info=True)
                        job.status = JobStatus.FAILED
                        job.error_message = str(e)
                    
                    # Save final state
                    session.add(job)
                    await session.commit()
                
                else:
                    # No jobs found
                    pass
            
            # Wait before next poll if no job was found or after processing
            # (If we processed one, we could loop immediately, but 5s is fine for this use case)
            if not job:
                await asyncio.sleep(5)
            else:
                await asyncio.sleep(1) 

        except Exception as e:
            logger.error(f"Worker main loop error: {e}")
            await asyncio.sleep(5)

async def main():
    # Initialize DB tables if they don't exist
    logger.info("Initializing database...")
    await init_db()
    
    # Start worker loop
    await process_jobs()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user.")
