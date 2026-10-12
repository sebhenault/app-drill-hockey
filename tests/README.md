# Tests de parcours

Tests de bout en bout écrits avec Playwright. Ils pilotent un vrai Chromium et
vérifient les parcours critiques, pas des détails d’implémentation.

## Préalables

```bash
npm install --no-save playwright   # ou installation globale : npm install -g playwright
npx http-server pwa -p 8099 -s &        # les tests attaquent http://127.0.0.1:8099
node tools/build-single.mjs             # requis par 06-mono-fichier.mjs
```

## Exécution

```bash
for f in tests/*.mjs; do echo "== $f"; node "$f"; done
```

Chaque test affiche une ligne `PASS` ou `ÉCHEC` par vérification, puis la liste
des erreurs JavaScript rencontrées dans la page. Les captures d’écran atterrissent
dans `tests/captures/` (ou dans `$SHOT_DIR`).

| Fichier | Couverture |
|---|---|
| `01-fumee.mjs` | démarrage, accueil, bibliothèque, fiche |
| `02-editeur.mjs` | surface, objets, 6 tracés, couleur, épaisseur, annuler/refaire, glisser, 3 séquences, fiche, sauvegarde, animation, réouverture |
| `03-filtres-plans-exports.mjs` | filtres combinés, pastilles, plan de pratique, totaux, dépassement, réordonnancement, exports PNG/SVG/JSON, code QR, lien |
| `04-responsive.mjs` | 390 px, 768 px, 1440 px : pas de défilement horizontal, tiroir mobile, zones tactiles ≥ 44 px |
| `05-partage-reglages-impression-horsligne.mjs` | guide des symboles, aller-retour du lien de partage, export/import global, thème, impression, clavier, service worker, hors ligne |
| `06-mono-fichier.mjs` | build autonome : démarrage en `file://`, aucune requête externe, persistance |
| `07-themes.mjs` | thème sombre, clair et `data-theme` imposé par le lecteur |
| `08-version-coachs.mjs` | liens de pratique et d’exercice pour les coachs, affichage mobile, vidéo intégrée et externe, points clés, lien tronqué, bouton du plan |
| `09-telephone-portrait.mjs` | iPhone : glace verticale en portrait, objet posé sous le doigt, étiquettes à l’endroit, texte agrandi, paysage et ordinateur inchangés |
| `10-import-lien.mjs` | lien collé (Bibliothèque, Paramètres) ouvert dans l’app, texte invalide refusé, bouton d’enregistrement lisible sur iPhone |
