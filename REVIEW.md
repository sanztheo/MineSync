# MineSync — Roadmap & État d'avancement

> Dernière mise à jour : 13 février 2026

---

## Vue d'ensemble

```
Backend Rust     [██████████████████████] 100%
Frontend UI      [████████████████░░░░░░]  75%
Game Launch (FE) [░░░░░░░░░░░░░░░░░░░░░]   0%
Sync Flow (FE)   [██████████░░░░░░░░░░░]  50%
Settings         [███░░░░░░░░░░░░░░░░░░]  15%
```

---

## Backend (Rust / Tauri) — 100%

Le backend est **complet et fonctionnel** sur tous les domaines. Aucun stub ou `todo!()` détecté.

| Module | Statut | Fichier(s) clé(s) |
|--------|--------|--------------------|
| Database (SQLite) | ✅ Fait | `services/database.rs` |
| Auth Microsoft | ✅ Fait | `services/auth.rs` |
| Instances CRUD | ✅ Fait | `commands/instance.rs`, `services/database.rs` |
| Minecraft Engine | ✅ Fait | `services/minecraft.rs` |
| Mod Loaders (4) | ✅ Fait | `services/loader/{fabric,forge,neoforge,quilt}.rs` |
| Mod Platforms | ✅ Fait | `services/mod_platform/{curseforge,modrinth}.rs` |
| Lancement du jeu | ✅ Fait | `services/launch.rs` |
| P2P (libp2p) | ✅ Fait | `services/p2p/mod.rs`, `swarm_loop.rs` |
| Sync Protocol | ✅ Fait | `services/sync_protocol/manifest_diff.rs` |
| Download Manager | ✅ Fait | `services/download.rs` |
| Install Modpack | ✅ Fait | `services/install.rs` |

### Détails backend

- **Database** : 6 tables (`accounts`, `instances`, `instance_mods`, `sync_sessions`, `sync_history`, `loader_installations`). WAL mode, foreign keys, soft delete.
- **Auth** : Device Code Flow complet (Microsoft → Xbox Live → XSTS → Minecraft Token). Refresh token fonctionnel.
- **Minecraft Engine** : Fetch version manifest Mojang, résolution libraries par OS, assets index, download client JAR.
- **Mod Loaders** : Fabric, Forge, NeoForge, Quilt — listing de versions et installation pour les 4.
- **Mod Platforms** : CurseForge + Modrinth unifiés avec recherche parallèle, déduplication par slug, résolution de dépendances transitives.
- **Lancement** : Spawn process Java, construction classpath + arguments, monitoring PID, kill, tracking play time.
- **P2P** : Swarm libp2p (TCP + Noise + Yamux), share codes base62 (`MINE-XXXXXX`), relay, DCUtR, AutoNAT, échange de manifestes.
- **Sync** : Algorithme de diff par nom/hash/version, state machine (AwaitingConfirmation → Syncing → Completed/Rejected), application des diffs en DB.
- **Downloads** : Parallèle (semaphore=4), vérification SHA1, retry avec backoff, skip des fichiers déjà cachés.
- **Install Modpack** : Extraction ZIP (CurseForge + Modrinth), parsing manifeste, download MC + loader + mods, copie overrides.

---

## Frontend (React / TypeScript) — 75%

### Pages terminées

| Page | Statut | Fonctionnalités |
|------|--------|-----------------|
| **Home** | ✅ Fait | Grille d'instances, création (version MC + loader), suppression avec confirmation, overlay progress d'install |
| **Auth** | ✅ Fait | Device code affiché + copie, polling, affichage profil + skin, logout |
| **BrowseMods** | ✅ Fait | Recherche debounced, filtres (tri, loader, version MC), pagination, cards avec icônes/badges, install modal |
| **BrowseModpacks** | ✅ Fait | Même features que BrowseMods, install modpack modal avec progress tracking |

### Pages partielles

| Page | Statut | Ce qui marche | Ce qui manque |
|------|--------|---------------|---------------|
| **InstanceDetail** | 🟡 Partiel | Onglet Mods (liste, remove, add), progress d'install | Onglet Files (stub), Onglet Settings (stub), boutons Play/Sync sans handler |
| **SyncHub** | 🟡 Partiel | P2P start/stop, génération share code, saisie code join | `confirmSync()` commenté, pas d'écoute sync entrante, historique placeholder |

### Pages stub

| Page | Statut | Description |
|------|--------|-------------|
| **Settings** | 🔴 Stub | UI présente (RAM slider, toggles, inputs) mais aucune persistance — tout reste en state local |

### Composants & infra frontend

| Élément | Statut |
|---------|--------|
| UI Kit (Button, Card, Badge, Input, Modal, Slider, Toggle) | ✅ Fait |
| Layout (TitleBar, Sidebar avec nav + profil) | ✅ Fait |
| Hooks (`useTauriCommand`, `useDebounce`, `useInstallProgress`) | ✅ Fait |
| IPC wrappers (`tauri.ts`) — 24/27 commandes | 🟡 Partiel |
| Types miroir Rust (`types.ts`) | ✅ Fait |

---

## Ce qui reste à faire

### P1 — Lancement du jeu (Play)

> Le backend est 100% prêt. Le frontend n'a **aucune intégration**.

- [ ] Ajouter les wrappers IPC dans `tauri.ts` : `launchInstance()`, `getGameStatus()`, `killGame()`
- [ ] Brancher le bouton Play sur `Home` et `InstanceDetail`
- [ ] Afficher le statut du jeu (Idle → Preparing → Running → Crashed)
- [ ] Bouton Kill quand le jeu tourne
- [ ] Afficher le progress de téléchargement au premier lancement (version MC + assets + libraries)
- [ ] Désactiver les actions sur l'instance pendant que le jeu tourne

### P2 — Sync P2P (finalisation)

> Backend prêt. Frontend à moitié branché.

- [ ] Débloquer `confirmSync()` (commenté dans SyncHub)
- [ ] Intégrer `getPendingSync()` pour détecter les syncs entrantes
- [ ] Brancher `applySyncSession()` après confirmation utilisateur
- [ ] Remplacer l'historique placeholder par les vraies données (`sync_history`)
- [ ] Ajouter des notifications de sync entrante

### P3 — Settings fonctionnels

> Nécessite potentiellement une nouvelle table/fichier de config côté Rust.

- [ ] Définir le modèle de settings (table SQLite ou fichier JSON)
- [ ] Créer les commandes Rust : `get_settings`, `update_settings`
- [ ] Ajouter les wrappers IPC
- [ ] Brancher la UI Settings sur le backend
- [ ] Charger les settings au démarrage de l'app

### P4 — InstanceDetail complet

- [ ] **Onglet Files** : ouvrir le dossier instance dans l'explorateur natif (ou mini file browser)
- [ ] **Onglet Settings** : JVM args per-instance, override RAM
- [ ] Corriger `InstallingPhantomCard` (référencé mais non défini dans Home)

### P5 — Polish & UX

- [ ] Composant download progress standalone (visible pendant le DL de versions MC)
- [ ] Système de notifications (erreurs, succès, sync entrante)
- [ ] Auto-refresh du token auth au lancement
- [ ] Error boundary React global
- [ ] Vérification tailles de fenêtre / responsive

---

## Commandes IPC — Couverture

### Branchées (24)

| Domaine | Commandes |
|---------|-----------|
| Auth | `startAuth`, `pollAuth`, `getProfile`, `logout`, `refreshAuth` |
| Instances | `listInstances`, `getInstance`, `createInstance`, `deleteInstance` |
| Minecraft | `listMcVersions`, `downloadVersion`, `getDownloadProgress` |
| Mods | `searchMods`, `searchModpacks`, `getModVersions`, `installMod`, `installModpack`, `listInstanceMods`, `removeMod` |
| P2P | `startP2p`, `stopP2p`, `getP2pStatus`, `shareModpack`, `joinViaCode` |
| Sync | `previewSync`, `getPendingSync`, `confirmSync`, `rejectSync`, `applySyncSession` |
| Install | `getInstallProgress` |

### Manquantes (3)

| Domaine | Commandes | Priorité |
|---------|-----------|----------|
| Launch | `launchInstance`, `getGameStatus`, `killGame` | **P1** |

---

## Architecture de référence

```
src-tauri/src/
├── lib.rs                          # Entry point + 38 commandes
├── errors.rs                       # AppError (thiserror)
├── models/                         # Structs serde
├── services/
│   ├── auth.rs                     # Microsoft Device Code Flow
│   ├── database.rs                 # SQLite (6 tables)
│   ├── download.rs                 # Downloads parallèles
│   ├── launch.rs                   # Lancement jeu + monitoring
│   ├── minecraft.rs                # Mojang API
│   ├── install.rs                  # Installation modpacks
│   ├── loader/                     # Fabric, Forge, NeoForge, Quilt
│   ├── mod_platform/               # CurseForge + Modrinth
│   ├── p2p/                        # libp2p swarm
│   └── sync_protocol/              # Manifest diff + state machine
└── commands/                       # 38 commandes Tauri (IPC)

src/
├── pages/                          # Home, Auth, BrowseMods, InstanceDetail, SyncHub, Settings
├── components/
│   ├── layout/                     # TitleBar, Sidebar
│   ├── ui/                         # Button, Card, Input, Badge, Modal, Slider, Toggle
│   └── install/                    # InstallModModal, InstallModpackModal
├── hooks/                          # useTauriCommand, useDebounce, useInstallProgress
└── lib/
    ├── types.ts                    # Types miroir Rust
    └── tauri.ts                    # Wrappers IPC (24/27)
```
