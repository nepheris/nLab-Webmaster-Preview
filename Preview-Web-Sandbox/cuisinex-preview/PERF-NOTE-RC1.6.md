# Cuisine X — RC1.6 performance fix

- Bibliothèque ne déclenche plus le chargement de l'index Ciqual.
- L'index Ciqual 2025 (3 484 aliments) est chargé uniquement à l'ouverture de la section Ingrédients.
- Le pont V72 est chargé uniquement pour Recettes/Ingrédients et reste en mémoire ; il n'écrit plus le gros état dans localStorage.
- Le cache local `cuisinex.preview.data.v4` est invalidé une fois pour supprimer les états surdimensionnés issus des versions précédentes.
