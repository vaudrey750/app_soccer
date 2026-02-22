# FFF Scraper API

Ce projet est une application Python asynchrone conçue pour récupérer, traiter et stocker les données de l'API de la Fédération Française de Football (FFF). Il utilise une architecture moderne basée sur des services, des repositories et des modèles typés.

## 🏗 Structure du Projet

Le projet est organisé de manière modulaire dans le dossier `src/` :

```
/opt/fff_api
├── docker-compose.yml      # Configuration des services Docker (Base de données)
├── pyproject.toml          # Gestion des dépendances et configuration du projet
├── src/
│   ├── client.py           # Point d'entrée principal (Façade) pour l'API FFF
│   ├── core/               # Composants de base (Client HTTP bas niveau)
│   ├── models/             # Définitions des données
│   │   ├── schemas.py      # Modèles Pydantic (Validation des données API)
│   │   └── db.py           # Modèles SQLModel (Tables de base de données)
│   ├── repositories/       # Couche d'accès aux données (CRUD vers la BDD)
│   └── services/           # Logique métier (Import, Orchestration, etc.)
└── tests/                  # Tests d'intégration et unitaires
```

## 🚀 Architecture Technique

Le projet suit une architecture en couches pour assurer la maintenabilité et la testabilité :

1.  **Client (`src/client.py`)** : Une façade qui simplifie l'utilisation de l'API FFF. Elle expose des méthodes claires (`get_club_matches`, `get_ranking`, etc.) et délègue les appels aux services appropriés.
2.  **Services (`src/services/`)** : Contiennent la logique métier.
    *   `ImportService` : Orchestre le processus complet d'importation (récupération API -> sauvegarde BDD).
    *   `StorageService` : Gère la persistance complexe (sauvegarde des dépendances comme Club -> Equipe -> Match).
    *   `ClubService`, `MatchService`, etc. : Gèrent les appels API spécifiques à chaque domaine.
3.  **Repositories (`src/repositories/`)** : Gèrent les interactions directes avec la base de données PostgreSQL via SQLModel/SQLAlchemy.
4.  **Models (`src/models/`)** :
    *   **Schemas** : Utilisés pour valider les réponses JSON de l'API.
    *   **DB** : Définissent la structure des tables SQL.

## 🛠 Prérequis

*   **Docker** et **Docker Compose** (pour la base de données PostgreSQL).
*   **Python 3.11+** (si exécution locale hors Docker).
*   Un gestionnaire de paquets comme `uv` ou `pip`.

## ⚙️ Installation et Configuration

1.  **Cloner le projet**

2.  **Configurer l'environnement**
    Créez un fichier `.env` à la racine (si nécessaire) ou utilisez les valeurs par défaut du `docker-compose.yml`.

3.  **Lancer la base de données**
    ```bash
    docker-compose up -d db
    ```

4.  **Installer les dépendances (Local)**
    ```bash
    pip install .
    # ou avec uv
    uv pip install .
    ```

## 💻 Utilisation

### Lancer les Tests
Le projet dispose d'une suite de tests d'intégration utilisant `pytest`.

```bash
python3 -m pytest
```

### Exemple d'utilisation (Script)

Vous pouvez créer un script pour lancer une importation :

```python
import asyncio
from src.client import FFFClient
from src.services.api_storage_service import APIStorageService
from src.services.import_service import ImportService, ImportConfig

async def main():
    async with FFFClient() as client:
        storage = APIStorageService(base_url="http://localhost:8000")
        service = ImportService(client, storage)
        
        config = ImportConfig(
            club_id=10423,  # Exemple ID Club
            label="Import Club Test"
        )
        
        try:
            await service.process_config(config)
        finally:
            await storage.close()


if __name__ == "__main__":
    asyncio.run(main())
```

## 📦 Stack Technique

*   **Langage** : Python 3.11+
*   **HTTP Client** : `httpx` (Asynchrone)
*   **Validation** : `Pydantic` v2
*   **ORM / Base de données** : `SQLModel` / `SQLAlchemy` (Async)
*   **Driver BDD** : `asyncpg`
*   **Tests** : `pytest`, `pytest-asyncio`
