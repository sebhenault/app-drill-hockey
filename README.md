# DrillBuilder Hockey

Application Web progressive (PWA) pour entraîneurs de hockey mineur : dessiner un
exercice sur une patinoire, le classer, l’animer, le partager et bâtir des plans
de pratique — **hors ligne, sans compte, sans serveur**.

Interface en français canadien. Architecture prête pour l’anglais.

---

## Ce que ça fait

| | |
|---|---|
| **Éditeur** | 9 surfaces de glace, 19 objets, 13 styles de trajectoire, 6 extrémités de ligne, sélection multiple, rotation, échelle, calques, verrouillage, grille et aimantation, annuler/refaire, copier/coller, symétries, zoom et déplacement, crayon libre |
| **Symboles** | Légende Hockey Canada / Hockey Québec : cercle ouvert à l’offensive, triangle ouvert à la défensive, F / D / C / W / G, C entouré pour l’entraîneur, disque plein, triangle plein pour un cône ; patinage avant, avec rondelle, arrière, arrière avec rondelle, passe, tir, pivot, arrêt à deux pieds. Les ajouts de l’application sont marqués « complément » dans le guide |
| **Séquences** | Plusieurs séquences par exercice, durée réglable, ligne du temps, lecture, pause, retour au début, vitesse 0,5× à 2×, objets qui suivent leur trajectoire |
| **Bibliothèque** | 22 exercices de démonstration originaux, recherche plein texte, filtres combinables (âge, habileté, situation, espace, durée, difficulté, gardien, vidéo, favoris, mes exercices), vues grille et liste |
| **Fiche** | 30 champs (objectifs, mise en place, déroulement, points d’enseignement, erreurs fréquentes, variantes, sécurité, mots-clés, source, vidéo…) |
| **Plans de pratique** | Glisser-déposer, durées additionnées automatiquement, alerte de dépassement non bloquante, échauffement/pause/conclusion/notes, impression avec une page par exercice |
| **Version coachs** | Lien pour une pratique complète ou pour un seul exercice : page épurée pour téléphone avec diagramme, vidéo et points clés, sans compte ni installation |
| **Exports** | PNG, SVG, JSON, impression/PDF, copie d’image dans le presse-papiers, lien de partage autonome, code QR |
| **Hors ligne** | Service worker + IndexedDB (repli localStorage). Aucune donnée ne quitte l’appareil |

---

## Envoyer une pratique aux autres coachs

1. Dans chaque exercice : **Éditeur → Informations**, colle l’adresse de la vidéo
   (YouTube ou Vimeo s’affichent dans la page ; toute autre adresse devient un
   bouton « Voir la vidéo ») et inscris les **points d’enseignement** : ce sont
   les points clés que verront les coachs.
2. Dans le plan de pratique : **Liens pour les coachs**.
   - **Partager toute la pratique** : un lien avec le déroulement minuté et tous
     les exercices ;
   - **Partager** à côté d’un exercice : un lien vers cet exercice seulement.
3. Sur téléphone, la feuille de partage s’ouvre (Messages, courriel…). Sur
   ordinateur, le lien est copié.

Le contenu voyage dans le lien lui-même : rien n’est stocké sur un serveur, et
quiconque a le lien peut voir la page (public, mais non référencé). Les liens
exigent que l’application soit publiée (voir « Déployer sur GitHub Pages »).

---

## Démarrer en local

Aucune dépendance, aucune étape de compilation : ce sont des modules ES servis tels quels.

```bash
npx http-server pwa -p 8099        # ou : python3 -m http.server 8099 -d pwa
```

Puis ouvrir <http://127.0.0.1:8099/>.

> Le protocole `file://` ne fonctionne pas pour la version multi-fichiers
> (les modules ES et le service worker exigent `http(s)://`).
> Pour un fichier unique ouvrable directement, voir « Version mono-fichier ».

---

## Tester sur chaque appareil

### iPhone / iPad

1. Sur l’ordinateur, lancer le serveur ci-dessus en écoutant sur le réseau local :
   `npx http-server pwa -p 8099 -a 0.0.0.0`
2. Récupérer l’adresse IP locale (`ipconfig getifaddr en0` sur macOS,
   `hostname -I` sur Linux) et ouvrir `http://<IP>:8099/` dans **Safari**.
3. Bouton **Partager** → **Sur l’écran d’accueil**. L’application s’ouvre ensuite
   en plein écran, sans barre d’adresse.

En portrait, l’éditeur pivote la glace à la verticale pour qu’elle remplisse
l’écran ; en paysage elle reste à plat. Les données ne changent pas : seul
l’affichage pivote, et les étiquettes restent à l’endroit.

Points à vérifier : barre d’outils en bas, tiroir coulissant (Joueurs / Lignes /
Équipement / Texte / Propriétés), pincement pour zoomer, rotation en paysage,
zones tactiles d’au moins 44 × 44 px.

> Safari n’installe une PWA que depuis une origine `https://` **ou** `localhost`.
> Sur un réseau local en `http://`, l’ajout à l’écran d’accueil fonctionne mais
> le service worker peut rester inactif : le mode hors ligne complet demande
> alors le déploiement GitHub Pages ci-dessous.

### Ordinateur

Souris + raccourcis clavier. La liste complète est dans
**Paramètres → Guide des symboles**, en bas de page :
`Ctrl/Cmd+Z`, `Ctrl/Cmd+Maj+Z`, `Ctrl/Cmd+C/V/D/A/S`, `Suppr`, `Échap`,
`Entrée`, `Espace`, flèches, `V` / `H` / `G`.

---

## Déployer sur GitHub Pages

Le dépôt contient `.github/workflows/deploy-pwa.yml`. Une fois activé
(**Settings → Pages → Source : GitHub Actions**), chaque poussée sur la branche
par défaut publie le dossier `pwa/` à l’adresse
`https://<utilisateur>.github.io/<dépôt>/`.

C’est le chemin recommandé pour un usage réel : HTTPS, donc service worker
actif, installation propre sur iOS, et une adresse partageable avec les autres
entraîneurs de l’association.

---

## Version mono-fichier

```bash
node tools/build-single.mjs      # → dist/drillbuilder-hockey.html
```

Concatène les 13 modules et la feuille de style en un seul fichier HTML autonome
(~325 Ko), ouvrable directement par double-clic, sans serveur et sans réseau.
Le script vérifie qu’aucun nom de premier niveau n’entre en collision et
reconstruit les espaces de noms (`import * as store`). Utile pour :

- envoyer l’application par courriel ou la déposer sur une clé USB ;
- la publier comme Artifact Claude ;
- archiver une version figée.

Seule différence avec la version servie : pas de service worker (inutile — la
page est déjà entièrement locale).

---

## Structure

```
pwa/
  index.html              coquille, métadonnées iOS, manifeste
  manifest.webmanifest    nom, icônes, raccourcis, mode standalone
  sw.js                   cache de la coquille, réseau d’abord pour les navigations
  styles.css              jetons de couleur, 3 états de thème, impression
  icons/                  PNG 192, 512, maskable, apple-touch
  js/
    app.js         routeur à fragment, écrans, formulaires, démarrage
    editor.js      éditeur de patinoire (Pointer Events, historique, animation)
    symbols.js     icônes SVG originales, styles de trajectoire, tests de survol
    rink.js        géométrie de la patinoire, 9 fenêtres de cadrage, grille
    render.js      rendu d’une séquence (miniature, fiche, export, impression)
    seed.js        22 exercices de démonstration
    plans.js       plans de pratique
    exporter.js    PNG / SVG / JSON / impression / lien de partage
    coach.js       version coachs : liens et page en lecture seule
    qr.js          générateur de code QR autonome (mode octet, niveau L, v1–10)
    store.js       IndexedDB avec repli localStorage
    taxonomy.js    âges, habiletés, situations, espaces, difficultés, couleurs
    i18n.js        dictionnaire fr-CA (+ amorce en)
    util.js        identifiants, échappement, validation d’URL, DOM, rôties
types/models.ts           modèles de données — source de vérité du format JSON
tools/build-single.mjs    assemblage mono-fichier
```

### Deux décisions qui expliquent le reste

**Le canevas est un SVG, pas un `<canvas>` bitmap.** Le test de survol, la
sélection, le zoom et l’export vectoriel deviennent alors triviaux, et le même
balisage sert à l’écran, à l’impression et aux fichiers exportés — ils ne peuvent
pas diverger.

**Les coordonnées sont en dixièmes de pied.** Une patinoire nord-américaine
occupe 2000 × 850 unités. Les neuf surfaces (glace complète, demi-glace, zones,
quart, sixième…) sont des fenêtres découpées dans un seul dessin : un balisage,
neuf cadrages. Un diagramme reste identique quel que soit l’écran.

---

## Vie privée

Aucun compte, aucun cookie de suivi, aucune analytique, aucune requête vers un
tiers. Tout vit dans le stockage du navigateur. **Paramètres → Effacer toutes mes
données** supprime tout, sans reste. Exporte le JSON avant de changer d’appareil
ou de vider le cache du navigateur.

Les exemples n’emploient jamais de nom de joueur : uniquement des étiquettes
(`F1`, `D2`, `G`, `X1`).

---

## Contenu et droits

Les 22 exercices de démonstration et tous les diagrammes ont été créés pour cette
application. Aucun texte, diagramme, image ou vidéo n’est repris d’un site tiers.

Les **symboles** suivent la légende conventionnelle de Hockey Canada et Hockey
Québec. C’est une convention de notation, pas une œuvre : s’en écarter rendrait les
diagrammes illisibles pour les autres entraîneurs. Chaque tracé SVG est néanmoins
dessiné par l’application — aucun fichier n’est repris. Le guide des symboles
distingue les entrées de la légende officielle des compléments propres à
DrillBuilder.

Hockey Canada, Hockey Québec, HockeyShare, Ice Hockey Systems et Loz Hockey sont
cités uniquement comme **liens externes de consultation**, avec la mention
« Contenu externe, droits appartenant à la source ». L’application n’a aucun lien
officiel avec ces organisations et ne présente aucun contenu comme provenant
d’elles.

Pour importer du contenu que tu possèdes ou que tu as le droit d’utiliser :
**Paramètres → Importer un fichier JSON** (le format est décrit dans
`types/models.ts`).

Chaque entraîneur doit adapter les exercices au niveau de ses joueurs, à
l’espace disponible et aux règles de sécurité de son association.
