# CuisineX preview — projections P019 en cours

Cette couche de preview expose des recettes P019 sans modifier leur statut métier.

## Sources chargées

- `aubergine-candidates-v1.json` — 22 candidates legacy de la famille `RF-AUBERGINE-PULPE` ;
- `p019-work-in-progress-v1.json` — recettes P019 draft/canonical absentes du catalogue principal de preview.

## Règles

- aucune candidate/draft n'est présentée comme validée ;
- les fiches auteur P019 priment sur le SQL lorsqu'un statut plus récent est documenté ;
- aucune traduction nouvelle n'est produite ;
- les totaux affichés à l'accueil sont calculés depuis les données réellement chargées ;
- cette projection est un consommateur de P019 et ne devient pas une seconde source de vérité.
