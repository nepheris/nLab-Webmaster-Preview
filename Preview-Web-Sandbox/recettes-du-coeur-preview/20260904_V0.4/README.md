# Les Recettes du Cœur — VNext 0.3 Preview

Nouvelle couche publique construite à partir du site V73.2 existant.

## Objectif
Produire une version visible et améliorable rapidement, sans exposer l'ancien espace Dev.

## Architecture
- pages publiques légères ;
- CSS/JS factorisés ;
- éditorial humain dans `content/pages/*.md` ;
- recettes / astuces / ingrédients réutilisent les référentiels structurés déjà présents dans le repo public ;
- aucune recette Chef candidate n'est intégrée tant que `READY_FOR_P002` n'est pas prouvé ;
- expérimentation multilingue issue du composant nLab SCR10, uniquement en Preview tant que le provider n'est pas validé.

## Déploiement
Ce dossier est un **overlay** à extraire à la racine du dépôt actuel.
Il faut conserver les répertoires existants `data/`, `recettes/` et les médias sous `assets/images/`.

Avant commit public, supprimer l'ancien répertoire `dev/`.
Voir `DEPLOY.md`.
