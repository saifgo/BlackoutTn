# BlackoutTN

Carte communautaire des coupures d'electricite en Tunisie. Application Vite + React + TypeScript, avec Leaflet, **Appwrite** (auth anonyme + Google, base de donnees temps reel) et Firebase (Hosting + Analytics uniquement).

- Chargement rapide (paquet initial < 500 KB hors GeoJSON, GeoJSON separe et lazy loaded)
- Mobile-first (largeur minimum 320 px, safe areas iOS)
- Mises a jour en temps reel (Appwrite Realtime)
- Sans inscription (Appwrite Anonymous Auth)
- Signalements expirent apres 6 heures
- Anti-abus: 1 signalement par zone par utilisateur toutes les 30 minutes

## Pile technique

- Frontend : Vite + React 18 + TypeScript
- Cartographie : Leaflet + React-Leaflet, tuiles OpenStreetMap
- Style : Tailwind CSS
- Etat serveur : TanStack Query + Appwrite Realtime
- Auth + base de donnees : Appwrite Cloud (Account anonyme + OAuth2 Google, Databases)
- Hebergement + Analytics : Firebase Hosting + Firebase Analytics

## Structure

```
src/
  App.tsx                    Racine, lazy-load de la carte
  main.tsx                   Point d'entree + QueryClientProvider
  appwrite/
    config.ts                Init du client Appwrite (Account + Databases)
    auth.ts                  Google OAuth + signOut + mapping utilisateur
  firebase/
    config.ts                Init Firebase (Analytics uniquement)
    analytics.ts             Wrapper safe pour Firebase Analytics
  lib/status.ts              Agregation reports -> couleur (0 / 1-4 / 5-9 / 10+)
  lib/reports.ts             Envoi Appwrite + rate-limit 30 min
  lib/geo.ts                 Chargement lazy du GeoJSON, bounds, slugify
  hooks/useAuth.ts           Sign-in anonyme automatique (Appwrite)
  hooks/useReports.ts        Ecouteur temps reel sur `reports` (Appwrite)
  hooks/useZoneStatus.ts     Agregation memoisee par zone
  components/
    Map/MapView.tsx          Carte Leaflet
    Map/ZoneLayer.tsx        Couche GeoJSON + styles dynamiques
    Map/ZonePopup.tsx        Popup avec les boutons de signalement
    SignInDialog.tsx         Dialogue Google OAuth (via Appwrite)
    TopBar.tsx               Logo, recherche, bouton stats
    SearchBox.tsx            Recherche par secteur / delegation / gouvernorat
    BottomPanel.tsx          Legende + CTA
    Legend.tsx               Legende des couleurs
    StatsPanel.tsx           Panneau statistiques
public/
  data/tn-sectors.geojson       2084 secteurs (imadas), ~1.7 Mo (simplifie + arrondi)
scripts/
  preprocess-geojson.mjs        Douglas-Peucker + normalisation (source: HDX COD-AB Tunisie, adm4)
  migrate-firestore-to-appwrite.mjs   Migration one-shot Firestore -> Appwrite
firebase.json                   Config Firebase Hosting (uniquement)
```

## Configuration Appwrite (base de donnees + auth)

1. Cree un projet sur https://cloud.appwrite.io.
2. Depuis **Overview -> Add platform -> Web**, ajoute ton nom d'hote de production **et** `localhost` pour le dev.
3. **Auth -> Settings** : active la methode **Anonymous**.
4. **Auth -> Settings -> OAuth2 Providers** : active **Google** et renseigne le Client ID / Client Secret depuis Google Cloud Console. Copie l'URI de callback fournie par Appwrite dans les "Authorized redirect URIs" de ton client OAuth Google.
5. **Databases -> Create database** (par ex. `blackouttn`), puis cree une collection `reports` avec les attributs :
   - `zoneId` string (required)
   - `userId` string (required)
   - `type` enum: `blackout`, `voltage`, `restore` (required)
   - `createdAt` integer, Unix ms (required)
   - `sectorId` string (optional)
   - `sectorName` string (optional)
6. Sur la collection `reports` :
   - **Indexes** : ajoute un index sur `createdAt` (utilise pour la fenetre glissante).
   - **Settings -> Permissions** : Read = `Users`, Create = `Users`. Pas de Update/Delete (les reports sont immuables). Les sessions anonymes comptent comme `Users` dans Appwrite.

Compromis de securite : les regles Firestore forcaient `createdAt == request.time`. Appwrite ne peut pas garantir un timestamp serveur sur un attribut client-set sans une Function. On accepte ce compromis (le rate-limit est deja client-side dans cette app) ; une Function Appwrite peut ajouter la garantie plus tard.

## Configuration Firebase (Hosting + Analytics)

1. Cree ou reutilise un projet Firebase sur https://console.firebase.google.com.
2. Depuis **Project settings -> General -> Your apps**, ajoute une application Web et recupere la config.
3. Verifie que Firebase Hosting est active (`firebase init hosting` si besoin) et mets a jour `.firebaserc` avec ton `projectId`.
4. (Optionnel) Active Analytics dans **Project settings -> Integrations -> Google Analytics** et note le `measurementId`.

## Variables d'environnement

Copie `.env.example` en `.env.local` et renseigne :

```
# Appwrite (obligatoire)
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=...
VITE_APPWRITE_DATABASE_ID=...
VITE_APPWRITE_REPORTS_COLLECTION_ID=...

# Firebase (Analytics)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...   # optionnel
```

## Migration des donnees Firestore -> Appwrite (une seule fois)

Le script `scripts/migrate-firestore-to-appwrite.mjs` copie la collection Firestore `reports` dans Appwrite en preservant l'`id` des documents (idempotent, les reruns sautent les documents deja importes) et l'`createdAt` d'origine.

1. Depuis Google Cloud Console, telecharge un **service account key** JSON pour ton projet Firestore.
2. Depuis Appwrite (**Overview -> API keys**), cree une **cle serveur** avec `databases.write` (et `databases.read` pour l'idempotence).
3. Installe les dependances du script (elles ne sont pas embarquees dans le bundle) :

   ```bash
   npm i -D firebase-admin node-appwrite
   ```

4. Exporte les variables et lance en dry-run :

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
   export FIREBASE_PROJECT_ID=your-firebase-project
   export APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   export APPWRITE_PROJECT_ID=your-appwrite-project
   export APPWRITE_API_KEY=your-appwrite-api-key
   export APPWRITE_DATABASE_ID=your-appwrite-db
   export APPWRITE_REPORTS_COLLECTION_ID=reports

   node scripts/migrate-firestore-to-appwrite.mjs
   ```

5. Relance avec `--commit` pour ecrire dans Appwrite :

   ```bash
   node scripts/migrate-firestore-to-appwrite.mjs --commit
   ```

Note : les `userId` migres restent les UID Firebase d'origine. Les nouveaux utilisateurs auront des `$id` Appwrite. C'est invisible sur la carte/timeline ; les anciens et nouveaux utilisateurs ne seront simplement pas lies entre les deux systemes.

## Developpement

```bash
npm install
npm run dev
```

L'application se lance sur http://localhost:5173. Ajoute `http://localhost` comme plateforme Web dans Appwrite (ou tolere le CORS local).

## Deploiement

Prerequis : Firebase CLI installe et connecte (`npm install -g firebase-tools && firebase login`).

```bash
npm run deploy          # build + deploy hosting
npm run deploy:hosting  # alias
```

## Modele de donnees

Collection Appwrite `reports` — chaque document :

```json
{
  "zoneId": "TN1359",
  "userId": "<appwrite $id ou legacy firebase uid>",
  "type": "blackout",
  "createdAt": 1729710000000,
  "sectorId": "TN135951",
  "sectorName": "Megrine Superieure"
}
```

## Performance

- GeoJSON simplifie ~ 274 KB, transfere sur demande via `fetch` (cache HTTP long).
- Vite `manualChunks` separe Appwrite, Firebase (Analytics), Leaflet et React Query.
- Tuiles OSM en cache HTTP navigateur.
- Ecouteur Appwrite Realtime : la charge initiale est une requete paginee, puis seuls les documents crees sont pousses (delta), au lieu d'un re-fetch complet a chaque changement. Bien plus econome en bande passante que l'ancien `onSnapshot`.
- Rendu Leaflet en canvas (`preferCanvas`) pour de meilleures performances mobiles.

## Accessibilite

- Zones interactives clavier (Tab + Enter/Espace).
- ARIA sur combobox de recherche, popup de zone (`role="dialog"`), panneau stats (`aria-modal`), overlays de chargement (`role="status"`), erreurs (`role="alert"`).
- Cibles tactiles >= 44 px.
- Palette a fort contraste, focus visible.
- Support `prefers-contrast: more`.

## Extensions prevues

Phase 2 : votes de confirmation, ETA de retablissement, integration STEG / Telegram / WhatsApp, Appwrite Function pour rate-limit + timestamp serveur.

Phase 3 : analytics historiques, heat maps, API publique, tableaux de bord par gouvernorat.

## Licence

Donnees de decoupage administratif (secteurs / delegations) derivees d'OpenStreetMap (ODbL) via HDX COD-AB Tunisie. Code sous MIT.
