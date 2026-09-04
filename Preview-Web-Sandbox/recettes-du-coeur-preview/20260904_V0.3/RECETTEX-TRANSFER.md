# RecetteX → Les Recettes du Cœur — transfert VNext 0.3

## Transféré dans cette candidate Preview

- **Barre multilingue / traduction automatique** : intégration expérimentale de `SCR10 — Web Auto Translate Bar`, déjà définie comme composant transverse à tester sur RecetteX et P002.
- **Markdown-first éditorial** : conservation de la logique `Markdown + front matter → rendu`, cohérente avec la direction CuisineX/RecetteX.
- **Séparation contenu / runtime** : l’éditorial humain reste sous `content/`, les données structurées sous les référentiels du site, et les vues restent rendues sans recopier la donnée métier.

## Non transféré automatiquement

- aucune recette candidate Chef tant que `READY_FOR_P002` n’est pas prouvé ;
- aucune base SQLite/SQL comme dépendance publique de la V1 ;
- aucun Nutri-Score tant que le moteur/référentiel n’est pas validé ;
- aucune traduction statique SEO sans décision séparée sur la stratégie multilingue.

## Statut de la traduction

La barre importée est **POC Preview uniquement**. Elle utilise le mécanisme client historique Google comme adaptateur expérimental et doit rester remplaçable. Le français reste la source et le site reste totalement utilisable si le provider est indisponible.
