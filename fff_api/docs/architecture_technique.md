# Documentation Architecture Technique - FFF API Scraper

## 1. Vue d'ensemble

Le projet **FFF API** est une solution d'ingestion et de gestion de données automatisée ciblant l'API de la Fédération Française de Football. Son objectif est de collecter, stocker et structurer les données des clubs, compétitions, équipes et matchs pour les rendre exploitables (statistiques, suivi, etc.).

Le projet a récemment migré d'une architecture orientée "Services Monolithiques" vers une **Clean Architecture** (Architecture Hexagonale simplifiée) pour assurer une meilleure maintenabilité et testabilité.

---

## 2. Architecture Globale

Le système repose sur une séparation stricte des responsabilités en couches concentriques.

### Diagramme de Flux (Data Flow)

```mermaid
graph TD
    User[Utilisateur / API] --> API[Couche API (FastAPI)]
    Cron[Scheduler / Worker] --> Ingestion[Service d'Ingestion]
    
    API --> UC[Application (Use Cases)]
    Ingestion --> UC
    
    subgraph "Application Core"
        UC --> Ports[Interfaces / Ports]
        Domain[Modèles de Domaine (SQLModel)]
    end
    
    subgraph "Infrastructure"
        FFF[Client FFF (HttpX)] -.-> Ports
        MinIO[MinIO (Raw Storage)] -.-> Ports
        DB[PostgreSQL (Structured Data)] -.-> Ports
    end
    
    UC --> FFF
    UC --> MinIO
    UC --> DB
```

---

## 3. Structure du Projet (Clean Architecture)

L'arborescence du code source (`src/`) est organisée comme suit :

| Dossier | Responsabilté |
|:---|:---|
| `src/domain/` | **Cœur du métier**. Contient les modèles de données (`models/`) et les interfaces (`ports/`). Aucune dépendance externe majeure. |
| `src/application/` | **Logique applicative**. Contient les **Use Cases** (ex: `ScrapeClubMatchesUseCase`). Chaque classe a une responsabilté unique. |
| `src/infrastructure/` | **Implémentations techniques**. Contient les accès concrets aux données : Base de données, Client API FFF, Stockage MinIO. |
| `src/api/` | **Point d'entrée HTTP**. Routes FastAPI qui exposent les données ou déclenchent des actions via les Use Cases. |
| `src/workers/` | **Processus d'arrière-plan**. Workers autonomes pour les tâches longues (importation massive). |

---

## 4. Composants Clés

### 4.1. Le Client FFF (Facade Pattern)
Le fichier `src/infrastructure/clients/fff/client.py` agit comme une **Façade**.
- Il n'implemente plus la logique métier directement.
- Il instancie et orchestre les **Use Cases** atomiques.
- Il expose des méthodes simples (`get_club_matches`) qui délèguent l'exécution aux Use Cases appropriés.

### 4.2. Les Use Cases (Scraping)
Situés dans `src/application/use_cases/scraping/`.
Chaque opération de scraping est isolée.
Exemple de flux standard d'un Use Case :
1.  **Récupération** : Appel au `DataProvider` (API FFF).
2.  **Raw Storage** : Sauvegarde immédiate du JSON brut dans MinIO (Data Lake).
3.  **Parsing/Save** (Optionnel) : Extraction et sauvegarde en base relationnelle.

### 4.3. Stockage des Données (Double couche)
1.  **Raw Data (MinIO)** :
    *   Objectif : Audit, Replay, Debug.
    *   Format : JSON brut tel que renvoyé par la FFF.
    *   Structure : `bucket/category/id/date/content.json`.
2.  **Structured Data (PostgreSQL)** :
    *   Objectif : Requêtes, Relations, Application métier.
    *   Techno : PostgreSQL + SQLModel (SQLAlchemy).
    *   Modèles : Stabilisés avec des relations ORM (`Relationship`) dans `src/domain/models/reference.py`.

---

## 5. Technologies & Stack

*   **Langage** : Python 3.11+
*   **Web Framework** : FastAPI
*   **ORM** : SQLModel (pydantic + SQLAlchemy)
*   **HTTP Client** : Httpx (Async)
*   **Stockage Objet** : MinIO (Compatible S3)
*   **Base de données** : PostgreSQL + PostGIS (pour les localisations)
*   **Migration** : Alembic
*   **Containerisation** : Docker & Docker Compose

---

## 6. Flux d'Ingestion (Worker)

Le système de worker (`src/workers/import_worker.py`) gère les tâches asynchrones lourdes.
1.  Le Scheduler déclenche un Job.
2.  Le Worker instancie le `FFFClient`.
3.  Le Worker itère sur les configurations d'import (Clubs à scanner).
4.  Pour chaque entité, les Use Cases sont exécutés séquentiellement (Info -> Teams -> Matches -> Calendar).
5.  Les résultats sont stockés de manière idempotente.

## 7. Commandes Utiles

*   **Lancer la stack** : `docker-compose up --build`
*   **Lancer les tests** : `pytest`
*   **Migrations DB** : `alembic upgrade head`
*   **Worker manuel** : `docker-compose run --rm worker python ...`
