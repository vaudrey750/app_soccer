import os

replacements = [
    ("app.fff.src.models.config", "src.domain.schemas.import_config"),
    ("app.fff.src.models.job", "src.domain.models.job"),
    ("app.fff.src.models", "src.domain.models"),
    ("app.fff.src.helpers.postgres_db", "src.infrastructure.database.session"),
    ("app.fff.src.helpers.minio_storage", "src.infrastructure.storage.minio"),
    ("app.fff.src.client", "src.infrastructure.clients.fff.client"),
    ("app.fff.src.core.base_client", "src.infrastructure.clients.fff.base"),
    ("app.fff.src.repositories", "src.infrastructure.database.repositories"),
    ("app.fff.src.services", "src.services"),
    ("app.fff.src.operations.store_fff_data", "src.services.ingestion"),
    ("from app.fff.src.api.api import api_router", "from src.api.router import api_router"),
    ("app.fff.src.api", "src.api"),
    ("app.fff.src", "src"),
]

def update_imports(root_dir):
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".py"):
                file_path = os.path.join(root, file)
                with open(file_path, "r") as f:
                    content = f.read()
                
                new_content = content
                for old, new in replacements:
                    new_content = new_content.replace(old, new)
                
                if new_content != content:
                    with open(file_path, "w") as f:
                        f.write(new_content)
                    print(f"Updated {file_path}")

update_imports("src")
