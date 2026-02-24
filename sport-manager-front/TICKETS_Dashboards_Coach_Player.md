# Tickets dev‑ready — Dashboards Coach & Joueur (multi‑équipes)

Source : PRD_Dashboards_Coach_Player.md
Date : 22 février 2026

## Conventions (DoD)

- Une story = un livrable testable en QA.
- Respect design system existant : composants et tokens déjà présents, pas de nouvelle palette.
- États requis pour les blocs data : Loading / Empty / Error.
- Multi‑équipes : le contexte (équipe vs club) est visible et toutes les actions sensibles sont non ambiguës.

### Définition “action sensible”
- Relancer des réponses, publier une compo, envoyer un message à plusieurs, démarrer/arrêter un live.

### Cibles techniques (indicatives)
- Coach : src/pages/coach/Dashboard.tsx
- Joueur : src/pages/player/Dashboard.tsx
- Contexte équipe : src/context/TeamContext.tsx, src/components/molecules/TeamSelector.tsx
- Services événements : src/services/* (selon existant)

---

## EPIC — Dashboards (MVP)

### MVP‑C1 — Coach : bloc “Événement Focus” + CTA primaire unique

**User story**
En tant que coach, je vois l’événement le plus critique (Focus) et je peux agir via un seul CTA principal.

**Scope**
- Ajout/complétion du bloc “Événement Focus” sur dashboard coach.
- Calcul du Focus selon les règles du PRD (scoring + exceptions).
- CTA primaire unique selon le contexte.

**Hors scope**
- Refonte des pages événement / match center.

**Critères d’acceptation (Given/When/Then)**
- Given je suis connecté avec rôle COACH/ADMIN/ASSISTANT, When j’ouvre le dashboard coach, Then je vois une carte “Événement Focus” en premier.
- Given l’événement Focus est un match, Then la carte affiche au minimum : date/heure, adversaire, lieu (ou état “lieu manquant”), et badge d’équipe.
- Given la présence est incomplète (au moins 1 “sans réponse”), Then le CTA primaire est “Relancer les réponses” (si mode équipe).
- Given la compo n’est pas publiée à J‑1/J, Then le CTA primaire est “Préparer la compo”.
- Given un match est live, Then le CTA primaire est “Ouvrir le live” et cet événement est Focus quel que soit le reste.
- Given je suis en mode Club (toutes équipes), When je clique un CTA sensible, Then l’app demande explicitement de choisir une équipe (ou désactive le CTA avec explication).

**États**
- Loading : skeleton carte focus.
- Empty : “Aucun événement à venir” + CTA “Créer un événement”.
- Error : message + bouton “Réessayer”.

**Checklist QA**
- Vérifier Focus en présence de 2+ événements (équipes différentes).
- Vérifier la visibilité du badge d’équipe.
- Vérifier que le CTA est unique (pas de second bouton d’action primaire).

---

### MVP‑C2 — Coach : bloc Présences (jauge + top “sans réponse” + relance)

**User story**
En tant que coach, je visualise la présence et je peux relancer les joueurs qui n’ont pas répondu.

**Critères d’acceptation**
- Given un événement Focus à venir, Then j’ai une jauge avec 4 catégories : confirmés, incertains, absents, sans réponse.
- Then j’ai une liste compacte (max 3) des “sans réponse” + lien “Voir tout”.
- Given mode équipe et rôle autorisé, When je clique “Relancer”, Then l’action cible uniquement l’équipe de l’événement et affiche un récap (équipe + nombre destinataires).
- Given mode Club, Then “Relancer” est désactivé (ou déclenche un choix d’équipe) avec message explicite.

**États**
- Loading/Empty/Error cohérents avec MVP‑X1.

**Checklist QA**
- Relance : vérifier l’équipe ciblée, le nombre de destinataires.
- Vérifier que l’action n’est pas possible si contexte ambigu.

---

### MVP‑P1 — Joueur : carte FUT “Ma Carrière” (hero) + présence au-dessus de la ligne de flottaison

**User story**
En tant que joueur, je vois une carte type FUT motivante en haut du dashboard et je peux confirmer ma présence sans scroller.

**Critères d’acceptation**
- Given je suis connecté en tant que joueur, When j’ouvre mon dashboard, Then le premier bloc est une carte FUT (identité + note globale + forme + niveau/XP).
- Given un événement Focus à venir et ma présence n’est pas confirmée, Then les CTAs “Je suis présent” et “Je suis absent” sont visibles sans scroller (au moins sur mobile standard).
- Given erreur de chargement profil, Then la carte affiche un état d’erreur + bouton “Réessayer”.

**États**
- Loading : skeleton carte.
- Error : carte “profil indisponible” + retry.

**Checklist QA**
- Vérifier mobile : la carte + CTA présence visibles.
- Vérifier accessibilité : focus clavier sur CTAs.

---

### MVP‑P2 — Joueur : mini‑carte “Prochain événement” + itinéraire

**User story**
En tant que joueur, je vois mon prochain événement (Focus) et je peux ouvrir l’itinéraire.

**Critères d’acceptation**
- Then la mini‑carte affiche : date/heure, type, adversaire si match, lieu.
- Given lieu manquant, Then la mini‑carte affiche “Lieu à confirmer” et désactive “Itinéraire”.
- Given plusieurs équipes, Then la mini‑carte affiche un badge d’équipe.

**Checklist QA**
- Vérifier que “Itinéraire” ouvre une URL valide (maps) ou déclenche le handler attendu.

---

### MVP‑X1 — Standardisation Loading / Empty / Error (Coach + Joueur)

**User story**
En tant qu’utilisateur, je comprends immédiatement l’état de chargement et je sais quoi faire en cas d’absence de données ou d’erreur.

**Critères d’acceptation**
- Loading : pas d’écran blanc, skeletons sur les blocs data.
- Empty : message utile + CTA (ex : créer événement / activer notifications).
- Error : message + “Réessayer” sur chaque bloc critique.

**Checklist QA**
- Simuler API down : vérifier erreurs par bloc.
- Simuler “aucun événement” : empty state correct.

---

## EPIC — Dashboards (V1)

### V1‑C1 — Coach : checklist de préparation (J‑2 → J)

**User story**
En tant que coach, je suis guidé par une checklist courte pour ne rien oublier avant un événement.

**Critères d’acceptation**
- Then j’ai un bloc checklist avec 4–6 items max.
- Then chaque item a un état (à faire / fait).
- Given mode Club, Then la checklist reflète l’événement Focus (et montre le badge équipe si nécessaire).

**Checklist QA**
- Vérifier que la checklist ne dépasse pas 6 items.

---

### V1‑C2 — Coach : post‑match “finaliser le match”

**User story**
En tant que coach, une fois le match terminé je suis incité à finaliser (notes, MOTM, résumé) depuis le dashboard.

**Critères d’acceptation**
- Given l’événement Focus est un match fini, Then le CTA primaire devient “Finaliser le match” (ou équivalent).
- Then le bloc affiche un rappel de ce qui manque (ex : notes non saisies).

**Checklist QA**
- Vérifier le basculement de CTA quand statut = finished.

---

### V1‑P1 — Joueur : progression & défis simples

**User story**
En tant que joueur, je suis motivé par une progression lisible et 1–2 défis simples.

**Critères d’acceptation**
- Then j’ai 1 défi hebdo + 1 défi match maximum.
- Then les défis sont compréhensibles et non bloquants.

**Checklist QA**
- Vérifier que l’UI n’affiche pas plus de 2 défis.

---

### V1‑X1 — Indicateurs de fiabilité “Dernière mise à jour”

**User story**
En tant qu’utilisateur, je sais à quel point les infos sont fraîches.

**Critères d’acceptation**
- Then les blocs sensibles affichent “Dernière mise à jour” (ou un équivalent).

**Checklist QA**
- Vérifier affichage sur dashboard coach et joueur.

---

## EPIC — Dashboards (V2)

### V2‑P1 — Joueur : badges/collection saison (non intrusif)

**User story**
En tant que joueur, je peux consulter mes badges de saison depuis la carte FUT.

**Critères d’acceptation**
- Then les badges sont accessibles depuis la carte FUT.
- Then ils n’ajoutent pas un flux intrusif sur le dashboard.

**Checklist QA**
- Vérifier que le dashboard reste centré sur l’événement Focus.

---

### V2‑C1 — Coach : synthèse week‑end multi‑équipes (vue club)

**User story**
En tant que coach/admin club, je vois une synthèse week‑end (équipes × événements) avec alertes, sans actions ambiguës.

**Critères d’acceptation**
- Given mode Club, Then une synthèse week‑end est visible (liste/mini grille) et chaque item a un badge équipe.
- Then aucune action sensible n’est exécutable sans sélection explicite d’équipe.

**Checklist QA**
- Vérifier qu’un clic sur action sensible force le choix d’équipe.

---

## Notes de QA transverses (anti‑régressions)

- Contexte équipe toujours visible dans l’en‑tête.
- Aucune action bulk possible en mode Club sans sélection d’équipe.
- 1 CTA primaire maximum par bloc.
- États Loading/Empty/Error présents sur les blocs qui chargent des données.
