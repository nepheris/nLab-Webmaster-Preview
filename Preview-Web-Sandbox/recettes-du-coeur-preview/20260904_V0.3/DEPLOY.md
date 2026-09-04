# Déploiement avec GitHub Manager

1. Ouvrir le clone local de `recettesducoeur/recettesducoeur.github.io`.
2. Faire une copie de sauvegarde ou une branche.
3. Extraire le contenu de ce ZIP **à la racine du dépôt** en remplaçant les fichiers homonymes.
4. Conserver les dossiers existants :
   - `data/`
   - `recettes/`
   - `assets/images/`
5. Supprimer complètement :
   - `dev/`
6. Optionnel mais recommandé pour nettoyer l'historique de distribution :
   - `_patch/`
   - `README-V37.md`
   - `README_TEST_V5.7.0.md`
   - `TEST_REPORT.txt`
7. Vérifier localement `index.html`, `recettes.html`, `fiche-recette.html?id=REC0001`.
8. Commit puis push avec GitHub Manager.

## Important
La VNext charge les référentiels actuels du dépôt public :
- `data/public/recettes.json`
- `data/referentiels/recettes.json`
- `data/public/astuces.json`
- `data/public/ingredients.json`

Ne pas supprimer ces données lors de l'application du ZIP.
