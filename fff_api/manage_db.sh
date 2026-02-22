#!/bin/bash
set -e

# Ensure containers are running
if [ -z "$(docker compose ps -q api)" ]; then
    echo "Error: API container is not running. Please run 'docker compose up -d' first."
    exit 1
fi

CMD=$1

case "$CMD" in
    "clean")
        echo "⚠️  WARNING: This will drop all tables tracked by Alembic."
        echo -n "Are you sure? [y/N] "
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])+$ ]]; then
            echo "Dropping tables..."
            docker compose exec api alembic downgrade base
            echo "Tables dropped."
        else
            echo "Operation cancelled."
        fi
        ;;
    
    "update")
        MSG=$2
        if [ -z "$MSG" ]; then
            echo "Please provide a migration message. Usage: ./manage_db.sh update \"message\""
            exit 1
        fi
        echo "Generating migration revision..."
        docker compose exec api alembic revision --autogenerate -m "$MSG"
        
        echo "Applying migration..."
        docker compose exec api alembic upgrade head
        
        echo "Database updated."
        ;;
        
    "init")
        echo "Initializing Database..."
        
        # 0. Create Schemas
        echo "Creating schemas..."
        docker compose exec api python scripts/create_schemas.py

        # Check if migrations already exist
        # We use a simple check on the directory inside the container
        # Path updated to reflect new structure (/app/src/migrations/versions)
        MIGRATION_COUNT=$(docker compose exec api sh -c "ls -1 /app/src/migrations/versions/*.py 2>/dev/null | wc -l")
        
        if [ "$MIGRATION_COUNT" -eq "0" ]; then
             echo "No existing migrations found. Creating initial migration..."
             docker compose exec api alembic revision --autogenerate -m "initial_init"
        else
             echo "Existing migrations found. Skipping creation."
        fi
        
        echo "Applying migrations..."
        docker compose exec api alembic upgrade head
        
        echo "Seeding static data (Types)..."
        docker compose exec api python scripts/seed_types.py
        
        echo "Restarting worker to ensure it picks up the schema..."
        docker compose restart worker

        echo "Initialization complete."
        ;;
        
    *)
        echo "Usage: ./manage_db.sh [init|update \"message\"|clean]"
        echo "  init   : Apply migrations and seed data (creates initial migration if needed)"
        echo "  update : Detect model changes, create migration file, and apply it"
        echo "  clean  : Downgrade database to base (drop tables)"
        exit 1
        ;;
esac
