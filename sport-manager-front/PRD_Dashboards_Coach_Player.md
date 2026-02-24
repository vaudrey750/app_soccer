# PRD — Dashboards Coach & Joueur (club multi‑équipes)

Date : 22 février 2026

## 1) Contexte & objectif

Nous construisons une app de gestion de football amateur. Objectif produit :
- Rivaliser avec **SportEasy** sur l’efficacité opérationnelle (coach/admin : convocations, compo, match live, relances, suivi).
- Rivaliser avec **SportCorico** sur la crédibilité et la lisibilité des infos match / résultats (fiabilité, fraîcheur, transparence).

Ce PRD couvre **uniquement** les dashboards **Coach** et **Joueur**, en tenant compte d’un club pouvant avoir **plusieurs équipes**.

### Objectifs UX
- Réduire le temps “je fais quoi maintenant ?” (1 action primaire claire).
- Maintenir un **contexte d’équipe** explicite en permanence (éviter les erreurs en mode club).
- Donner au joueur un espace **fun** et motivant (carte FUT), sans nuire à l’efficacité.

### Non‑objectifs (hors scope)
- Ajouter de nouvelles pages produit au-delà de ce qui est décrit ici.
- Refonte complète du design system (on s’aligne sur les composants existants).
- Refonte du modèle de données / back‑end (on spécifie des attentes UX et des règles).

## 2) Personae & périmètre

### Coach (et staff)
- Besoin : préparer les événements, gérer présence, compo/tactique, match live, post‑match.
- “Pain” : surcharge en week‑end (plusieurs équipes), relances, infos éparses.

### Joueur
- Besoin : savoir quand/jouer/où, confirmer présence, vivre le vestiaire, progression.
- “Pain” : manque de feedback, manque de jeu, pas de gratification.

## 3) Principes structurants multi‑équipes

### 3.1 Mode Équipe vs Mode Club
- **Mode Équipe** : une équipe sélectionnée. Les actions “engageantes” (relancer, publier compo, envoyer message) ciblent uniquement cette équipe.
- **Mode Club** : aucune équipe sélectionnée (“Tout / Club”). Les écrans doivent :
  - Afficher un badge de contexte : `Club (toutes équipes)`.
  - Interdire ou demander un choix explicite d’équipe avant toute action sensible.

### 3.2 Garde‑fous obligatoires
- Toute action “bulk” (relance, publication, message) doit afficher :
  - l’équipe cible,
  - le nombre de destinataires,
  - et refuser l’action si contexte ambigu.

### 3.3 Règle de cohérence de contexte
- Le contexte d’équipe doit être visible **dans l’en‑tête** de chaque dashboard.
- Si une carte/événement appartient à une équipe différente du contexte courant, afficher un badge d’équipe sur la carte.

## 4) Règles de priorité : “Événement Focus”

But : déterminer quel événement mettre en avant quand il y en a plusieurs (plusieurs équipes / plusieurs événements).

### 4.1 Scoring (proposition)
Pour chaque événement `E`, calculer un score :
- Urgence temporelle :
  - < 24h : +50
  - 24–72h : +30
  - 3–7 jours : +10
- Statut (match) :
  - `live` : +100
  - `starting_soon` : +60
  - `not_started` : +20
  - `finished` : +0
- Rôle utilisateur :
  - Coach : +20 si compo non publiée / présence incomplète
  - Joueur : +20 si présence non confirmée
- Risque opérationnel :
  - lieu manquant / horaires incohérents : +30

Choisir l’événement au score max. En cas d’égalité : prendre le plus proche dans le temps.

### 4.2 Exceptions
- Si un match est `live`, il est **toujours** Focus.
- En mode Club, si Focus appartient à une équipe, afficher fortement le badge de cette équipe.

## 5) Backlog priorisé (MVP → V1 → V2)

> Format : **User story** + critères d’acceptation.

### MVP (valeur immédiate)

#### MVP‑C1 — Coach : bloc “Prochain événement Focus”
- En tant que coach, je vois l’événement le plus critique, avec CTA principal.
- Acceptation :
  - Affiche date/heure/lieu/adversaire (si match) + équipe.
  - CTA unique dépend du contexte :
    - présence incomplète → `Relancer les réponses` (si autorisé)
    - compo non publiée (J‑1/J) → `Préparer la compo`
    - match live → `Ouvrir le live`
  - En mode Club : CTA sensible exige sélection d’équipe.

#### MVP‑C2 — Coach : jauge de présence et liste des “à relancer”
- Acceptation :
  - Jauge : Confirmés / Incertains / Absents / Sans réponse.
  - Liste “Sans réponse” actionable (relance) si permissions OK.

#### MVP‑P1 — Joueur : carte FUT “Ma Carrière” en haut
- En tant que joueur, j’ai un écran fun et identitaire.
- Acceptation :
  - Carte visible en premier bloc, avec : poste, note globale, points forme, niveau.
  - CTA de présence “Je suis présent / absent” visible sans scroller (si événement Focus à venir).

#### MVP‑P2 — Joueur : mini‑carte “Prochain événement” + itinéraire
- Acceptation :
  - Affiche lieu + bouton `Itinéraire`.
  - Si lieu manquant : état “Lieu à confirmer”.

#### MVP‑X1 — États Loading / Empty / Error standardisés
- Acceptation :
  - Loading : skeletons (pas d’écran vide blanc).
  - Empty : message utile + CTA.
  - Error : message + action `Réessayer`.

### V1 (complétion & fiabilité)

#### V1‑C1 — Coach : checklist de préparation (J‑2 → J)
- Acceptation :
  - Liste 4–6 items max (présence, compo, messages, matériel…).
  - Chaque item a un état (à faire / fait).

#### V1‑C2 — Coach : post‑match (notes / MOTM / résumé)
- Acceptation :
  - Après match fini, le dashboard met en avant “finaliser le match”.

#### V1‑P1 — Joueur : progression et défis simples
- Acceptation :
  - 1 défi hebdo + 1 défi match (ex : “valider ma présence”, “voter MOTM”).

#### V1‑X1 — Indicateurs de fiabilité
- Acceptation :
  - “Dernière mise à jour” sur les blocs sensibles (résultats, live).

### V2 (gamification avancée)

#### V2‑P1 — Joueur : collection / badges saison
- Acceptation :
  - Badges non intrusifs, accessibles depuis la carte FUT.

#### V2‑C1 — Coach : pilotage multi‑équipes (vue club)
- Acceptation :
  - Vue synthèse week‑end : équipes × événements, alertes.
  - Aucun CTA ambigu (exige choix d’équipe).

## 6) Spécifications “wireframe textuel”

### 6.1 Écran — Dashboard Coach (“Vestiaire”)

#### En‑tête (sticky)
1. Titre : `Espace Coach`.
2. Contexte équipe :
   - chip `Équipe: U15 A` ou `Club: toutes équipes`.
3. Accès rapide : `Sélecteur d’équipe`.

#### Corps (ordre exact des blocs)
1. **Bloc A — Événement Focus**
   - Contenu : date/heure, type (match/entrainement), adversaire, lieu, équipe.
   - CTA primaire (1 seul) : selon règles §5 MVP‑C1.
   - États :
     - Loading : skeleton carte.
     - Empty : “Aucun événement à venir” + CTA `Créer un événement`.
     - Error : “Impossible de charger l’événement” + `Réessayer`.

2. **Bloc B — Présences**
   - Jauge + 3 lignes max “Sans réponse” (voir tout).
   - CTA secondaire : `Relancer` (si permissions et mode équipe).
   - En mode club : bouton désactivé + texte “Choisir une équipe pour relancer”.

3. **Bloc C — Alertes staff (infirmier / suspensions / papiers)**
   - Liste compacte de 0–3 alertes.
   - Empty : “Aucune alerte”.

4. **Bloc D — Compo rapide (si match)**
   - Mini‑aperçu (formation + titulaires clés) + état publication.
   - CTA : `Préparer la compo`.

5. **Bloc E — Checklist préparation** (V1)
   - 4–6 items.

6. **Bloc F — Activité / messages récents**
   - 3 items max.

#### Actions sensibles (permissions)
- `Relancer`, `Publier compo`, `Démarrer/Arrêter live` : réservées à COACH/ADMIN/ASSISTANT.

### 6.2 Écran — Dashboard Joueur (“Ma Carrière”)

#### En‑tête (sticky)
1. Titre : `Ma Carrière`.
2. Contexte : chip équipe ou club.

#### Corps (ordre exact des blocs)
1. **Bloc A — Carte FUT (hero)**
   - Identité : photo, nom, poste.
   - Stats : note globale, forme, niveau, “XP”.
   - États :
     - Loading : skeleton carte.
     - Error : carte en mode “dégradé” + “Profil indisponible” + `Réessayer`.

2. **Bloc B — Prochain événement Focus**
   - Mini‑carte : date/heure/lieu/adversaire + badge équipe.
   - CTA primaire :
     - si présence non confirmée → `Je suis présent` + option `Je suis absent`.
     - sinon → `Voir le détail`.
   - CTA secondaire : `Itinéraire`.

3. **Bloc C — Vestiaire (feed)**
   - 3 items max : message coach, photo, info.
   - Empty : “Rien de neuf” + “Active les notifications”.

4. **Bloc D — Défi du moment** (V1)
   - 1 carte : “Gagne +X XP si…”.

5. **Bloc E — Paiement / caisse (si applicable)**
   - Statut : à jour / en retard + CTA `Payer`.

#### Règles multi‑équipes
- Si joueur appartient à plusieurs équipes :
  - Le Focus suit l’algorithme §4.
  - Les confirmations de présence doivent toujours indiquer l’équipe concernée.

## 7) Matrice de permissions (synthèse)

- Coach / Assistant / Admin :
  - Peut créer événement, relancer, gérer compo, publier, gérer live, éditer stats.
- Joueur :
  - Peut confirmer présence, voir compo (selon timing), voter MOTM, commenter.
- Supporter :
  - Lecture seule (hors scope ici, mention pour cohérence).

## 8) Critères qualité (DoD UX)
- Contexte d’équipe visible et non ambigu.
- 1 CTA primaire maximum par bloc.
- États Loading/Empty/Error présents sur les blocs de données.
- Aucune action sensible possible en “mode club” sans sélection explicite d’équipe.

---

Annexe (optionnelle) : si vous voulez, je peux aussi générer une version “stories dev” (tickets) dérivées de ce PRD, en gardant strictement le même périmètre.
