# BlackoutTN

Carte communautaire des coupures d'electricite en Tunisie. Application Vite + React + TypeScript, avec Leaflet, Firebase Anonymous Auth et Cloud Firestore. Deployable sur Firebase Hosting en une seule commande.

- Chargement rapide (paquet initial < 500 KB hors GeoJSON, GeoJSON separe et lazy loaded)
- Mobile-first (largeur minimum 320 px, safe areas iOS)
- Mises a jour en temps reel (Firestore `onSnapshot`)
- Sans inscription (Firebase Anonymous Auth)
- Signalements expirent apres 6 heures
- Anti-abus: 1 signalement par zone par utilisateur toutes les 30 minutes

## Pile technique

- Frontend : Vite + React 18 + TypeScript
- Cartographie : Leaflet + React-Leaflet, tuiles OpenStreetMap
- Style : Tailwind CSS
- Etat serveur : TanStack Query + Firestore `onSnapshot`
- Backend : Firebase Anonymous Auth + Cloud Firestore
- Hebergement : Firebase Hosting

## Structure

```
src/
  App.tsx                    Racine, lazy-load de la carte
  main.tsx                   Point d'entree + QueryClientProvider
  firebase/config.ts         Init Firebase depuis les variables d'env VITE_*
  lib/status.ts              Agregation reports -> couleur (0 / 1-4 / 5-9 / 10+)
  lib/reports.ts             Envoi Firestore + rate-limit 30 min
  lib/geo.ts                 Chargement lazy du GeoJSON, bounds, slugify
  hooks/useAuth.ts           Sign-in anonyme automatique
  hooks/useReports.ts        Ecouteur temps reel sur `reports`
  hooks/useZoneStatus.ts     Agregation memoisee par zone
  components/
    Map/MapView.tsx          Carte Leaflet
    Map/ZoneLayer.tsx        Couche GeoJSON + styles dynamiques
    Map/ZonePopup.tsx        Popup avec les boutons de signalement
    TopBar.tsx               Logo, recherche, bouton stats
    SearchBox.tsx            Recherche par secteur / delegation / gouvernorat
    BottomPanel.tsx          Legende + CTA
    Legend.tsx               Legende des couleurs
    StatsPanel.tsx           Panneau statistiques
public/
  data/tn-sectors.geojson       2084 secteurs (imadas), ~1.7 Mo (simplifie + arrondi)
scripts/
  preprocess-geojson.mjs        Douglas-Peucker + normalisation (source: HDX COD-AB Tunisie, adm4)
firebase.json, .firebaserc      Config Hosting + Firestore
firestore.rules                 Regles de securite
firestore.indexes.json          Index composites reports
```

## Configuration Firebase

1. Cree un projet Firebase sur https://console.firebase.google.com.
2. Active **Authentication -> Sign-in method -> Anonymous** ET **Google**.
   - Pour Google, choisis un email de support et sauvegarde.
3. Cree une base **Cloud Firestore** en mode production, region `europe-west1` recommandee.
4. Depuis **Project settings -> General -> Your apps**, ajoute une application Web et copie la config.
5. Copie `.env.example` en `.env.local` et renseigne les valeurs :

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

6. Mets a jour `.firebaserc` avec ton `projectId` (remplace `your-project-id`).

### Connexion Google (FirebaseUI)

Le bouton **Se connecter** de la barre du haut ouvre le widget officiel [FirebaseUI Auth](https://github.com/firebase/firebaseui-web). Aucune configuration supplementaire n'est necessaire au-dela d'activer Google comme provider dans Firebase Auth (etape 2 ci-dessus).

FirebaseUI est configure avec `autoUpgradeAnonymousUsers: true` : lorsqu'un visiteur anonyme se connecte, sa session est **liee** a son compte Google via `linkWithCredential`, ce qui preserve son UID Firebase et tous les signalements effectues avant la connexion. En cas de conflit (compte Google deja existant), on bascule sur le compte existant conformement aux recommandations Firebase.

Le module `firebaseui` (et son CSS) est charge en lazy import : le widget n'affecte pas le bundle initial et n'est telecharge que lorsque l'utilisateur clique sur **Se connecter**.

## Developpement

```bash
npm install
npm run dev
```

L'application se lance sur http://localhost:5173.

## Deploiement en une commande

Prerequis : Firebase CLI installe et connecte.

```bash
npm install -g firebase-tools
firebase login
```

Ensuite :

```bash
npm run deploy
```

Cette commande enchaine `vite build`, deploie `dist/` sur Firebase Hosting **et** publie les regles Firestore.

Deploiements partiels :

- `npm run deploy:hosting` : uniquement l'app Web
- `npm run deploy:rules` : uniquement `firestore.rules` + `firestore.indexes.json`

## Regles de securite Firestore

Voir `firestore.rules`. Points cles :

- Toutes les lectures / ecritures exigent `request.auth != null` (auth anonyme comprise).
- Un utilisateur ne peut creer un `report` que pour lui-meme (`userId == request.auth.uid`).
- `type` doit valoir `blackout` ou `voltage`.
- `createdAt` doit etre `request.time` (empeche la falsification de dates).
- Les reports sont **immuables** (aucune mise a jour ni suppression cote client).
- La collection `zones` (metadonnees optionnelles) est en lecture seule cote client ; les ecritures se font depuis un environnement d'administration (SDK Admin ou console).

Le rate-limit **1 signalement / zone / 30 minutes** est applique cote client. Un renforcement cote serveur necessiterait une Cloud Function (roadmap Phase 2).

## Donnees geographiques

`public/data/tn-sectors.geojson` contient 2084 secteurs (imadas) tunisiens normalises. Chaque secteur reference sa delegation parente, qui sert de cle d'agregation (`delegationId` = `zoneId` des signalements) :

```json
{
  "id": "TN135951",
  "name": "Megrine Superieure",
  "delegation": "Mégrine",
  "delegationId": "TN1359",
  "governorate": "Ben Arous"
}
```

Source : [HDX COD-AB Tunisie](https://data.humdata.org/dataset/cod-ab-tun) (niveau administratif 4, extrait OSM), pretraite avec `scripts/preprocess-geojson.mjs` (simplification Douglas-Peucker + arrondi des coordonnees). La carte affiche les secteurs, mais les signalements et la coloration sont agreges au niveau delegation. Pour regenerer :

```bash
node scripts/preprocess-geojson.mjs
```

## Modele de donnees

`reports/{autoId}`

```json
{
  "zoneId": "ben-arous-megrine",
  "userId": "<firebase uid>",
  "type": "blackout",
  "createdAt": "<serverTimestamp>"
}
```

`zones/{zoneId}` (optionnel, cache) — non ecrit par le client dans le MVP :

```json
{
  "name": "Megrine",
  "governorate": "Ben Arous",
  "reportCount": 14,
  "status": "red",
  "lastReportAt": 1753080000
}
```

## Performance

- GeoJSON simplifie ~ 274 KB, transfere sur demande via `fetch` (cache HTTP long) au lieu d'etre inclus dans le bundle.
- Vite `manualChunks` separe Firebase, Leaflet et React Query pour un meilleur cache.
- Tuiles OSM en cache HTTP navigateur.
- Ecouteur Firestore filtre sur `where('createdAt','>=', now - 6h)` : on ne recoit que les signalements actifs.
- Rendu Leaflet en canvas (`preferCanvas`) pour de meilleures performances mobiles.

## Accessibilite

- Zones interactives clavier (Tab + Enter/Espace).
- ARIA sur combobox de recherche, popup de zone (`role="dialog"`), panneau stats (`aria-modal`), overlays de chargement (`role="status"`), erreurs (`role="alert"`).
- Cibles tactiles >= 44 px.
- Palette a fort contraste, focus visible.
- Support `prefers-contrast: more`.

## Extensions prevues

Phase 2 : votes de confirmation, ETA de retablissement, integration STEG / Telegram / WhatsApp, Cloud Functions pour rate-limit serveur.

Phase 3 : analytics historiques, heat maps, API publique, tableaux de bord par gouvernorat.

## Licence

Donnees de decoupage administratif (secteurs / delegations) derivees d'OpenStreetMap (ODbL) via HDX COD-AB Tunisie. Code sous MIT.
