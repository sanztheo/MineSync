# MineSync - Research Document

> Recherche APIs, protocoles et patterns pour le launcher Minecraft MineSync.
> Dernière mise à jour : 2026-02-13

---

## Table des matières

1. [API Mojang / Minecraft](#1-api-mojang--minecraft)
2. [Microsoft Authentication (Device Code Flow)](#2-microsoft-authentication-device-code-flow)
3. [API CurseForge](#3-api-curseforge)
4. [API Modrinth](#4-api-modrinth)
5. [libp2p en Rust](#5-libp2p-en-rust)
6. [Mod Loaders](#6-mod-loaders)
7. [Launchers existants (références)](#7-launchers-existants-références)
8. [Lancement du jeu Minecraft](#8-lancement-du-jeu-minecraft)

---

## 1. API Mojang / Minecraft

### 1.1 Version Manifest

**URL :** `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`

**Structure :**
```json
{
  "latest": {
    "release": "1.21.11",
    "snapshot": "26.1-snapshot-7"
  },
  "versions": [
    {
      "id": "1.21.11",
      "type": "release",
      "url": "https://piston-meta.mojang.com/v1/packages/<sha1>/<id>.json",
      "time": "2025-12-09T...",
      "releaseTime": "2025-12-09T...",
      "sha1": "<hash>",
      "complianceLevel": 1
    }
  ]
}
```

- `type` : `"release"` | `"snapshot"` | `"old_beta"` | `"old_alpha"`
- `complianceLevel` : 0 ou 1 (1 = nécessite acceptation EULA)
- `url` : lien vers le JSON détaillé de la version

### 1.2 Version JSON (détail d'une version)

Chaque version a un JSON détaillé accessible via `versions[].url`. Structure principale :

```json
{
  "id": "1.21.11",
  "type": "release",
  "mainClass": "net.minecraft.client.main.Main",
  "javaVersion": { "component": "java-runtime-gamma", "majorVersion": 21 },
  "complianceLevel": 1,
  "assetIndex": {
    "id": "20",
    "sha1": "<hash>",
    "size": 443999,
    "totalSize": 802455431,
    "url": "https://piston-meta.mojang.com/v1/packages/<sha1>/20.json"
  },
  "downloads": {
    "client": { "sha1": "<hash>", "size": 12345678, "url": "https://..." },
    "server": { "sha1": "<hash>", "size": 12345678, "url": "https://..." },
    "client_mappings": { "sha1": "<hash>", "size": 12345678, "url": "https://..." },
    "server_mappings": { "sha1": "<hash>", "size": 12345678, "url": "https://..." }
  },
  "libraries": [ ... ],
  "arguments": {
    "game": [ ... ],
    "jvm": [ ... ]
  }
}
```

### 1.3 Format des Libraries

```json
{
  "name": "com.mojang:brigadier:1.0.18",
  "downloads": {
    "artifact": {
      "path": "com/mojang/brigadier/1.0.18/brigadier-1.0.18.jar",
      "sha1": "<hash>",
      "size": 77267,
      "url": "https://libraries.minecraft.net/com/mojang/brigadier/1.0.18/brigadier-1.0.18.jar"
    }
  },
  "rules": [
    { "action": "allow", "os": { "name": "windows" } }
  ]
}
```

**Résolution Maven → path :** `<group>/<artifact>/<version>/<artifact>-<version>.jar`
- Exemple : `com.mojang:brigadier:1.0.18` → `com/mojang/brigadier/1.0.18/brigadier-1.0.18.jar`

**Rules :** Filtrage conditionnel par OS (`windows`, `osx`, `linux`), architecture, et features.

### 1.4 Arguments

Les arguments sont des arrays mixtes (strings + objets conditionnels) :

```json
{
  "arguments": {
    "game": [
      "--username", "${auth_player_name}",
      "--version", "${version_name}",
      "--gameDir", "${game_directory}",
      "--assetsDir", "${assets_root}",
      "--assetIndex", "${assets_index_name}",
      "--uuid", "${auth_uuid}",
      "--accessToken", "${auth_access_token}",
      {
        "rules": [{ "action": "allow", "features": { "is_demo_user": true } }],
        "value": "--demo"
      }
    ],
    "jvm": [
      "-Djava.library.path=${natives_directory}",
      "-Dminecraft.launcher.brand=${launcher_name}",
      "-cp", "${classpath}"
    ]
  }
}
```

**Variables de substitution :**

| Variable | Description |
|----------|-------------|
| `${auth_player_name}` | Nom du joueur |
| `${auth_uuid}` | UUID du compte |
| `${auth_access_token}` | Token Minecraft |
| `${version_name}` | ID de la version |
| `${game_directory}` | Dossier .minecraft |
| `${assets_root}` | Dossier assets |
| `${assets_index_name}` | ID de l'asset index |
| `${natives_directory}` | Dossier natives extraites |
| `${classpath}` | Toutes les libs + client.jar |
| `${launcher_name}` | Nom du launcher |
| `${launcher_version}` | Version du launcher |

### 1.5 Assets

L'asset index est un JSON avec tous les fichiers (textures, sons, etc.) :

```json
{
  "objects": {
    "minecraft/sounds/ambient/cave/cave1.ogg": {
      "hash": "ab12cd34...",
      "size": 12345
    }
  }
}
```

**Téléchargement :** `https://resources.download.minecraft.net/<2-premiers-hex>/<hash-complet>`
**Stockage :** `.minecraft/assets/objects/<2-premiers-hex>/<hash-complet>`

---

## 2. Microsoft Authentication (Device Code Flow)

### 2.1 Flow complet (6 étapes)

```
[1] Device Code Request → Afficher code à l'utilisateur
[2] Poll Token → Récupérer access_token Microsoft
[3] Xbox Live Auth → XBL Token
[4] XSTS Auth → XSTS Token
[5] Minecraft Auth → Bearer Token Minecraft
[6] Get Profile → UUID + Username
```

### 2.2 Étape 1 : Device Code Request

```
POST https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode
Content-Type: application/x-www-form-urlencoded

client_id=<AZURE_CLIENT_ID>
&scope=XboxLive.signin offline_access
```

**Réponse :**
```json
{
  "device_code": "G_abc123...",
  "user_code": "ABCD-1234",
  "verification_uri": "https://microsoft.com/devicelogin",
  "expires_in": 900,
  "interval": 5
}
```

L'utilisateur doit aller sur `verification_uri` et entrer `user_code`.

> **Note :** Le `client_id` doit être enregistré dans Azure AD en tant qu'application "Mobile and desktop applications" avec le redirect URI `https://login.microsoftonline.com/common/oauth2/nativeclient`.

### 2.3 Étape 2 : Poll Token (boucle)

```
POST https://login.microsoftonline.com/consumers/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:device_code
&client_id=<AZURE_CLIENT_ID>
&device_code=<device_code>
```

Polluer toutes les `interval` secondes jusqu'à obtenir `access_token` ou expiration.

**Réponse succès :**
```json
{
  "access_token": "EwA...",
  "refresh_token": "M.C5...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "XboxLive.signin"
}
```

### 2.4 Étape 3 : Xbox Live Authentication

```
POST https://user.auth.xboxlive.com/user/authenticate
Content-Type: application/json

{
  "Properties": {
    "AuthMethod": "RPS",
    "SiteName": "user.auth.xboxlive.com",
    "RpsTicket": "d=<access_token>"
  },
  "RelyingParty": "http://auth.xboxlive.com",
  "TokenType": "JWT"
}
```

> **Important :** Le préfixe `d=` est nécessaire pour le token Microsoft OAuth2.

**Réponse :**
```json
{
  "Token": "eyJ...",
  "DisplayClaims": {
    "xui": [{ "uhs": "2533274..." }]
  }
}
```

Sauvegarder `Token` (XBL token) et `uhs` (user hash).

### 2.5 Étape 4 : XSTS Token

```
POST https://xsts.auth.xboxlive.com/xsts/authorize
Content-Type: application/json

{
  "Properties": {
    "SandboxId": "RETAIL",
    "UserTokens": ["<XBL_TOKEN>"]
  },
  "RelyingParty": "rp://api.minecraftservices.com/",
  "TokenType": "JWT"
}
```

**Réponse :**
```json
{
  "Token": "eyJ...",
  "DisplayClaims": {
    "xui": [{ "uhs": "2533274..." }]
  }
}
```

**Erreurs possibles :**
- `2148916233` : Pas de compte Xbox (rediriger vers création)
- `2148916235` : Xbox non disponible dans le pays
- `2148916238` : Compte enfant sans famille Xbox

### 2.6 Étape 5 : Minecraft Authentication

```
POST https://api.minecraftservices.com/authentication/login_with_xbox
Content-Type: application/json

{
  "identityToken": "XBL3.0 x=<UHS>;<XSTS_TOKEN>",
  "ensureLegacyEnabled": true
}
```

**Réponse :**
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "username": "..."
}
```

### 2.7 Étape 6 : Vérifier ownership + profil

**Vérifier que le compte possède Minecraft :**
```
GET https://api.minecraftservices.com/entitlements/mcstore
Authorization: Bearer <MC_ACCESS_TOKEN>
```

**Récupérer le profil :**
```
GET https://api.minecraftservices.com/minecraft/profile
Authorization: Bearer <MC_ACCESS_TOKEN>
```

**Réponse profil :**
```json
{
  "id": "<UUID-sans-tirets>",
  "name": "PlayerName",
  "skins": [...],
  "capes": [...]
}
```

### 2.8 Refresh Token

Pour renouveler sans re-authentifier :

```
POST https://login.microsoftonline.com/consumers/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&client_id=<AZURE_CLIENT_ID>
&refresh_token=<REFRESH_TOKEN>
&scope=XboxLive.signin offline_access
```

---

## 3. API CurseForge

### 3.1 Configuration

| Paramètre | Valeur |
|-----------|--------|
| Base URL | `https://api.curseforge.com` |
| Auth Header | `x-api-key: <API_KEY>` |
| API Key | Obtenir sur [console.curseforge.com](https://console.curseforge.com/) |
| Game ID Minecraft | `432` |
| Pagination max | `pageSize=50`, `index + pageSize <= 10000` |

### 3.2 Endpoints principaux

#### Recherche de mods
```
GET /v1/mods/search?gameId=432&searchFilter=jei&sortField=2&sortOrder=desc&pageSize=20&index=0
```

**Paramètres de recherche :**

| Param | Type | Description |
|-------|------|-------------|
| `gameId` | int | **Requis.** 432 pour Minecraft |
| `classId` | int | Catégorie (6 = mods, 12 = texture packs, 4471 = modpacks) |
| `categoryId` | int | Sous-catégorie |
| `gameVersion` | string | Ex: `"1.20.1"` |
| `searchFilter` | string | Texte libre (nom/auteur) |
| `sortField` | int | 1=Featured, 2=Popularity, 3=LastUpdated, 4=Name, 5=Author, 6=TotalDownloads |
| `sortOrder` | string | `"asc"` ou `"desc"` |
| `modLoaderType` | int | 1=Forge, 4=Fabric, 6=NeoForge |
| `index` | int | Offset pagination |
| `pageSize` | int | Max 50 |

#### Obtenir un mod
```
GET /v1/mods/{modId}
```

#### Obtenir les fichiers d'un mod
```
GET /v1/mods/{modId}/files?gameVersion=1.20.1&modLoaderType=4
```

#### Obtenir plusieurs mods (batch)
```
POST /v1/mods
Content-Type: application/json

{ "modIds": [238222, 306612], "filterPcOnly": true }
```

#### Mods en vedette
```
POST /v1/mods/featured
Content-Type: application/json

{ "gameId": 432, "excludedModIds": [], "gameVersionTypeId": null }
```

### 3.3 Format de réponse (Mod)

```json
{
  "data": {
    "id": 238222,
    "gameId": 432,
    "name": "Just Enough Items (JEI)",
    "slug": "jei",
    "summary": "...",
    "downloadCount": 200000000,
    "authors": [{ "id": 123, "name": "mezz" }],
    "logo": { "thumbnailUrl": "https://..." },
    "categories": [{ "id": 423, "name": "API and Library" }],
    "latestFiles": [{
      "id": 4567890,
      "fileName": "jei-1.20.1-15.2.0.27.jar",
      "downloadUrl": "https://edge.forgecdn.net/files/...",
      "gameVersions": ["1.20.1"],
      "modLoader": 4
    }],
    "dateCreated": "2014-10-19T...",
    "dateModified": "2024-01-15T..."
  }
}
```

> **Note :** Certains mods ont `downloadUrl: null`. Dans ce cas, construire l'URL :
> `https://edge.forgecdn.net/files/{fileId / 1000}/{fileId % 1000}/{fileName}`

### 3.4 Rate Limits

Pas de rate limits officiellement documentés, mais des throttling ont été rapportés. Recommandation : limiter à ~2 req/sec et implémenter un retry avec backoff exponentiel.

---

## 4. API Modrinth

### 4.1 Configuration

| Paramètre | Valeur |
|-----------|--------|
| Base URL | `https://api.modrinth.com/v2` |
| Auth | Non requis pour lecture (optionnel : `Authorization: mrp_<token>`) |
| Rate Limit | **300 req/min** par IP |
| User-Agent | **Requis.** Ex: `MineSync/1.0.0 (contact@minesync.dev)` |

**Headers Rate Limit :**
- `X-Ratelimit-Limit` : max req/min
- `X-Ratelimit-Remaining` : restantes
- `X-Ratelimit-Reset` : secondes avant reset

### 4.2 Endpoints principaux

#### Recherche de projets
```
GET /v2/search?query=sodium&facets=[["project_type:mod"],["versions:1.20.1"],["categories:fabric"]]&limit=20&offset=0&index=relevance
```

**Paramètres :**

| Param | Type | Description |
|-------|------|-------------|
| `query` | string | Texte de recherche |
| `facets` | JSON array | Filtres multi-critères (AND entre groupes, OR dans un groupe) |
| `index` | string | Tri : `relevance`, `downloads`, `follows`, `newest`, `updated` |
| `offset` | int | Pagination |
| `limit` | int | Max 100 |

**Facets courantes :**
- `["project_type:mod"]`, `["project_type:modpack"]`, `["project_type:resourcepack"]`
- `["versions:1.20.1"]`
- `["categories:fabric"]`, `["categories:forge"]`, `["categories:neoforge"]`

#### Obtenir un projet
```
GET /v2/project/{id|slug}
```

#### Lister les versions d'un projet
```
GET /v2/project/{id|slug}/version?loaders=["fabric"]&game_versions=["1.20.1"]
```

#### Obtenir une version
```
GET /v2/version/{id}
```

#### Identifier une version par hash
```
GET /v2/version_file/{sha1|sha512}?algorithm=sha512
```

#### Obtenir plusieurs projets (batch)
```
GET /v2/projects?ids=["AABBCCDD","EEFFGGHH"]
```

### 4.3 Format de réponse

**Projet :**
```json
{
  "slug": "sodium",
  "title": "Sodium",
  "description": "...",
  "project_type": "mod",
  "downloads": 50000000,
  "icon_url": "https://cdn.modrinth.com/...",
  "categories": ["optimization", "fabric"],
  "game_versions": ["1.20.1", "1.21"],
  "loaders": ["fabric", "quilt"],
  "id": "AANobbMI",
  "team": "...",
  "published": "2021-01-01T...",
  "updated": "2024-06-15T..."
}
```

**Version :**
```json
{
  "id": "abcdef12",
  "project_id": "AANobbMI",
  "name": "Sodium 0.5.8",
  "version_number": "0.5.8",
  "game_versions": ["1.20.1"],
  "loaders": ["fabric"],
  "files": [{
    "url": "https://cdn.modrinth.com/data/.../sodium-fabric-0.5.8.jar",
    "filename": "sodium-fabric-0.5.8.jar",
    "primary": true,
    "size": 1234567,
    "hashes": {
      "sha1": "abc123...",
      "sha512": "def456..."
    }
  }],
  "dependencies": [
    { "project_id": "P7dR8mSH", "dependency_type": "required" }
  ]
}
```

---

## 5. libp2p en Rust

### 5.1 Crate et Features

**Version actuelle :** `0.56.0`

```toml
[dependencies]
libp2p = { version = "0.56", features = [
  "tcp",              # Transport TCP
  "noise",            # Encryption
  "yamux",            # Multiplexing
  "tokio",            # Async runtime
  "identify",         # Peer identification
  "ping",             # Liveness check
  "relay",            # Circuit Relay v2
  "dcutr",            # Direct Connection Upgrade (hole punching)
  "autonat",          # NAT detection
  "mdns",             # Local network discovery
  "gossipsub",        # Pub/Sub messaging
  "kad",              # Kademlia DHT (optionnel)
  "macros",           # Dérive NetworkBehaviour
] }
tokio = { version = "1", features = ["full"] }
```

### 5.2 Architecture P2P pour MineSync

```
┌─────────────────────────────────────────────────┐
│                  NetworkBehaviour                 │
├──────────┬──────────┬──────────┬────────────────┤
│ Identify │  Relay   │  DCUtR   │   AutoNAT      │
│          │ (client) │          │                 │
├──────────┼──────────┼──────────┼────────────────┤
│   Ping   │ Gossipsub│  mDNS    │  Request/       │
│          │ (sync)   │ (local)  │  Response       │
└──────────┴──────────┴──────────┴────────────────┘
```

### 5.3 Concepts clés

**Swarm :** Conteneur principal qui gère les connexions, les protocoles et les événements réseau.

```rust
use libp2p::{identity, SwarmBuilder, noise, tcp, yamux};

let local_key = identity::Keypair::generate_ed25519();

let swarm = SwarmBuilder::with_existing_identity(local_key)
    .with_tokio()
    .with_tcp(tcp::Config::default(), noise::Config::new, yamux::Config::default)?
    .with_behaviour(|key| MyBehaviour::new(key))?
    .with_swarm_config(|cfg| cfg.with_idle_connection_timeout(Duration::from_secs(60)))
    .build();
```

**NetworkBehaviour :** Trait définissant le comportement réseau. On combine plusieurs sous-comportements :

```rust
use libp2p::swarm::NetworkBehaviour;

#[derive(NetworkBehaviour)]
struct MyBehaviour {
    identify: libp2p::identify::Behaviour,
    ping: libp2p::ping::Behaviour,
    relay_client: libp2p::relay::client::Behaviour,
    dcutr: libp2p::dcutr::Behaviour,
    autonat: libp2p::autonat::Behaviour,
    gossipsub: libp2p::gossipsub::Behaviour,
}
```

### 5.4 Circuit Relay v2

Le relay permet aux peers derrière NAT de communiquer via un serveur relais public.

**Concepts :**
- **Reservation :** Un peer privé réserve un slot sur le relay
- **Relayed Connection :** Connexion transitant par le relay (limité en durée et données)
- **Circuit address :** `/ip4/<relay-ip>/tcp/4001/p2p/<relay-id>/p2p-circuit/p2p/<target-id>`

**Serveur Relay :**
```rust
// Le relay server doit être sur une IP publique
let behaviour = relay::Behaviour::new(local_peer_id, relay::Config::default());
swarm.listen_on("/ip4/0.0.0.0/tcp/4001".parse()?)?;
```

**Client (derrière NAT) :**
```rust
// Se connecter au relay et réserver un slot
let relay_addr = "/ip4/<RELAY_IP>/tcp/4001/p2p/<RELAY_PEER_ID>".parse()?;
swarm.dial(relay_addr.clone())?;
swarm.listen_on(relay_addr.with(Protocol::P2pCircuit))?;
```

### 5.5 Hole Punching (DCUtR)

**Flow :**
1. Peer A et Peer B sont tous les deux connectés au Relay
2. A demande une connexion relayée vers B
3. DCUtR mesure le RTT entre A et B via le relay
4. DCUtR coordonne un "simultaneous open" TCP/UDP
5. Si succès → connexion directe peer-to-peer (plus besoin du relay)

**Prérequis :**
- Les deux peers doivent avoir `relay::client::Behaviour` + `dcutr::Behaviour`
- `identify::Behaviour` est nécessaire pour échanger les adresses
- `autonat::Behaviour` détecte si le peer est derrière un NAT

### 5.6 AutoNAT

Détecte automatiquement si le peer est public ou privé :

```rust
let autonat = libp2p::autonat::Behaviour::new(
    local_peer_id,
    libp2p::autonat::Config {
        boot_delay: Duration::from_secs(10),
        refresh_interval: Duration::from_secs(30),
        ..Default::default()
    },
);
```

**Résultats possibles :**
- `NatStatus::Public(addr)` → Le peer est accessible publiquement
- `NatStatus::Private` → Derrière NAT, utiliser relay + dcutr
- `NatStatus::Unknown` → Pas encore déterminé

### 5.7 Pattern pour MineSync

```
[Démarrage]
  1. Générer/charger keypair Ed25519
  2. Construire Swarm avec tous les behaviours
  3. Écouter sur port local

[Détection NAT]
  4. AutoNAT vérifie la connectivité
  5. Si privé → se connecter au relay et réserver

[Connexion entre peers]
  6. Peer A partage son adresse relayée (via code/QR/lien)
  7. Peer B dial l'adresse relayée de A
  8. DCUtR tente le hole punch
  9. Si réussi → connexion directe
  10. Sinon → rester sur relay (plus lent mais fonctionnel)

[Sync]
  11. Utiliser Gossipsub ou Request/Response custom pour échanger les données
```

---

## 6. Mod Loaders

### 6.1 Fabric

**Meta API :** `https://meta.fabricmc.net/`

#### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /v2/versions/game` | Toutes les versions Minecraft supportées |
| `GET /v2/versions/loader` | Toutes les versions du loader |
| `GET /v2/versions/loader/{game_version}` | Loaders compatibles pour une version |
| `GET /v2/versions/loader/{game_version}/{loader_version}` | Détails + libraries |
| `GET /v2/versions/loader/{game_version}/{loader_version}/profile/json` | Profil launcher complet |
| `GET /v2/versions/intermediary` | Mappings intermediary |
| `GET /v2/versions/yarn` | Mappings Yarn |

#### Installation dans un launcher

1. `GET /v2/versions/loader/{game}/{loader}/profile/json` → retourne un JSON compatible launcher
2. Le JSON contient `mainClass`, `libraries` (avec URLs Maven), et `arguments`
3. Télécharger les libraries depuis les Maven repos Fabric
4. Merger les libraries et arguments avec le version JSON vanilla
5. Utiliser `mainClass` du loader au lieu de celle de vanilla

**Loader stable actuel :** `0.18.1` (pour MC 1.21.11)

### 6.2 Forge / NeoForge

#### NeoForge Maven

**Repository :** `https://maven.neoforged.net/releases/`
**Versions API :** `https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge`

**Réponse :**
```json
{
  "isSnapshot": false,
  "versions": [
    "21.11.38-beta",
    "21.11.37-beta",
    "26.1.0.0-alpha.10+snapshot-6",
    ...
  ]
}
```

**Pattern URL installer :**
```
https://maven.neoforged.net/releases/net/neoforged/neoforge/{VERSION}/neoforge-{VERSION}-installer.jar
```

#### Installation programmatique (Forge/NeoForge)

Le Forge installer contient un `install_profile.json` avec :

```json
{
  "spec": 1,
  "profile": "NeoForge",
  "version": "neoforge-21.5.75",
  "minecraft": "1.21.5",
  "json": "/version.json",
  "libraries": [ ... ],
  "processors": [ ... ],
  "data": { ... }
}
```

**Flow d'installation :**

1. Télécharger l'installer JAR
2. Extraire `install_profile.json` et `version.json` du JAR
3. Télécharger toutes les `libraries` (même format que Mojang)
4. Exécuter les `processors` séquentiellement :
   - Chaque processor est un JAR à exécuter avec des arguments
   - Ils patchent le client Minecraft (remapping, patching binaire)
   - Variables : `{MINECRAFT_JAR}`, `{ROOT}`, `{LIBRARY_DIR}`, `{SIDE}`
5. Installer le `version.json` dans le dossier versions
6. Les processors ont un cache d'outputs (skip si fichier existe déjà)

**Processors typiques :**
1. `installertools` : Extraction et préparation
2. `installertools` : Download mappings Mojang
3. `jarsplitter` : Séparation des classes
4. `AutoRenamingTool` : Remapping SRG
5. `BinaryPatcher` : Application des patches bytecode

> **Alternative simplifiée :** Pour les versions récentes de NeoForge (26.1+), le processus est simplifié avec patching automatique au démarrage.

#### Forge Legacy

**Maven :** `https://files.minecraftforge.net/maven/`
**Versions :** `https://files.minecraftforge.net/net/minecraftforge/forge/`
**URL pattern :** `https://maven.minecraftforge.net/net/minecraftforge/forge/{mc}-{forge}/forge-{mc}-{forge}-installer.jar`

### 6.3 Quilt

**Meta API :** `https://meta.quiltmc.org/`

#### Endpoints (v3)

| Endpoint | Description |
|----------|-------------|
| `GET /v3/versions/game` | Versions Minecraft supportées |
| `GET /v3/versions/loader` | Versions du loader |
| `GET /v3/versions/loader/{game_version}` | Loaders pour une version |
| `GET /v3/versions/loader/{game_version}/{loader_version}` | Détails + launcherMeta |
| `GET /v3/versions/loader/{game_version}/{loader_version}/profile/json` | Profil launcher |
| `GET /v3/versions/quilt-mappings` | Mappings Quilt |
| `GET /v3/versions/quilt-mappings/{game_version}` | Mappings par version |
| `GET /v3/versions/hashed` | Hashed Mojmap versions |

**Installation :** Identique à Fabric — le endpoint `/profile/json` retourne un JSON complet avec mainClass, libraries et arguments.

> **Note :** Les versions nécessitent un URL encoding (ex: `1.14%20Pre-Release%205`).

### 6.4 Résumé comparatif

| Loader | API Meta | Installation | Complexité |
|--------|----------|-------------|------------|
| Fabric | REST simple, profile JSON | Merger libraries + mainClass | Faible |
| Quilt | REST simple (comme Fabric) | Idem Fabric | Faible |
| NeoForge | Maven API + installer JAR | Processors + patching | Élevée |
| Forge | Maven + installer JAR | Processors + patching | Élevée |

---

## 7. Launchers existants (références)

### 7.1 Theseus (Modrinth App)

**Repo :** [github.com/modrinth/code](https://github.com/modrinth/code)

**Stack :** Tauri (Rust backend) + Vue.js/Nuxt (frontend)

**Architecture :**
```
apps/
├── app/              # Tauri wrapper (Rust)
├── app-frontend/     # Vue.js UI (Nuxt)
packages/
├── app-lib/          # Core logic library (Rust)
```

**Patterns intéressants :**
- **SQLite** pour la base de données interne
- **Séparation lib/app :** `app-lib` contient toute la logique, utilisable en CLI ou GUI
- **State management Tauri :** `Mutex<State>` dans `Arc` via `tauri::State`
- **Config dir :** Personnalisable via `THESEUS_CONFIG_DIR`

### 7.2 Prism Launcher

**Repo :** [github.com/PrismLauncher/PrismLauncher](https://github.com/PrismLauncher/PrismLauncher)

**Stack :** C++ / Qt6

**Architecture :**
- **Singleton Application** avec managers centralisés (instances, accounts, themes, Java)
- **Instance hierarchy :** `BaseInstance` → `MinecraftInstance` avec `PackProfile`
- **PackProfile :** Gère les composants (version MC, loader, libraries)
- **ResourceAPI abstraction :** Interface unifiée pour Modrinth et CurseForge
- **Task-based async :** Toutes les I/O héritent de `Task` avec progress signaling
- **ETag caching :** Cache HTTP avec ETags pour les téléchargements
- **Lazy initialization :** Subsystèmes non-critiques chargés à la demande

**Patterns à retenir pour MineSync :**
1. **API unifiée pour les plateformes de mods** (ResourceAPI)
2. **Système de composants** pour les instances (version + loader + mods)
3. **Download manager** avec concurrence et vérification SHA
4. **Settings hierarchy** (global → instance → override)

---

## 8. Lancement du jeu Minecraft

### 8.1 Commande de lancement

```bash
java [JVM_ARGS] -cp [CLASSPATH] [MAIN_CLASS] [GAME_ARGS]
```

**Exemple concret :**
```bash
java \
  -Xmx2G -Xms512M \
  -Djava.library.path=/path/to/natives \
  -Dminecraft.launcher.brand=MineSync \
  -Dminecraft.launcher.version=1.0.0 \
  -cp "/path/to/lib1.jar:/path/to/lib2.jar:/path/to/client.jar" \
  net.minecraft.client.main.Main \
  --username PlayerName \
  --version 1.21.11 \
  --gameDir /path/to/.minecraft \
  --assetsDir /path/to/assets \
  --assetIndex 20 \
  --uuid abcdef1234567890 \
  --accessToken eyJ... \
  --userType msa \
  --versionType release
```

### 8.2 Étapes de préparation au lancement

```
1. Télécharger version JSON depuis manifest
2. Télécharger client.jar (via downloads.client)
3. Télécharger toutes les libraries (filtrer par rules/OS)
4. Extraire les natives (.dll/.so/.dylib) dans un dossier temporaire
5. Télécharger l'asset index
6. Télécharger tous les assets manquants
7. Si mod loader : installer (Fabric: merger JSON, Forge: run processors)
8. Construire le classpath (toutes les libs + client.jar)
9. Substituer les variables dans les arguments
10. Lancer java avec JVM args + classpath + mainClass + game args
```

### 8.3 Java Runtime

| Version MC | Java requis | Component |
|-----------|-------------|-----------|
| 1.17-1.20.4 | Java 17 | `java-runtime-gamma` |
| 1.20.5+ | Java 21 | `java-runtime-delta` |
| < 1.17 | Java 8 | `jre-legacy` |

Le champ `javaVersion.majorVersion` du version JSON indique la version requise.

---

## Références

- [Mojang Version Manifest](https://piston-meta.mojang.com/mc/game/version_manifest_v2.json)
- [wiki.vg - Microsoft Authentication](https://wiki.vg/Microsoft_Authentication_Scheme)
- [wiki.vg - Launching the game](https://wiki.vg/Launching_the_game)
- [CurseForge API Docs](https://docs.curseforge.com/rest-api/)
- [Modrinth API Docs](https://docs.modrinth.com/api/)
- [libp2p Rust](https://docs.rs/libp2p/latest/libp2p/)
- [libp2p Hole Punching Tutorial](https://docs.rs/libp2p/latest/libp2p/tutorials/hole_punching/)
- [Fabric Meta API](https://meta.fabricmc.net/)
- [Quilt Meta API](https://meta.quiltmc.org/)
- [NeoForge Maven](https://maven.neoforged.net/)
- [NeoForge Installer Internals](https://notes.highlysuspect.agency/neoforge-installer.html)
- [Inside a Minecraft Launcher](https://ryanccn.dev/posts/inside-a-minecraft-launcher/)
- [Theseus (Modrinth App)](https://github.com/modrinth/code)
- [Prism Launcher](https://github.com/PrismLauncher/PrismLauncher)
- [Microsoft Device Code Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code)
