# Frontend

## Vue d'ensemble

Le frontend est une application **React 19** avec **TypeScript**, stylisee avec **Tailwind CSS v4**. Il communique avec le backend Rust via le systeme IPC de Tauri (`invoke` pour les commandes, `listen` pour les evenements).

## Stack

| Technologie | Role |
|-------------|------|
| React 19 | Framework UI |
| TypeScript | Typage statique |
| Tailwind CSS v4 | Styling (dark theme) |
| React Router DOM v7 | Routing client-side |
| Lucide React | Icones |
| Tauri API v2 | Communication IPC |

## Pages

### Home (`src/pages/Home.tsx`)

Page principale affichant la grille d'instances. Fonctionnalites :
- Liste des instances actives avec carte visuelle
- Badge du loader (couleur par type)
- Statut jeu global (Running / Preparing / Crashed)
- Progression pre-download visible et persistante
- Boutons Play et Sync par instance (Play desactive si Java non pret)
- Modal de creation d'instance (nom, version MC, loader)
- Modal de confirmation de suppression
- Carte "Add Instance" en pointilles

### Auth (`src/pages/Auth.tsx`)

Flow de connexion Microsoft :
- Bouton de demarrage du Device Code Flow
- Affichage du code utilisateur + lien microsoft.com/link
- Polling automatique (spinner)
- Affichage du profil apres connexion
- Bouton de deconnexion

### BrowseMods (`src/pages/BrowseMods.tsx`)

Recherche unifiee de mods :
- Barre de recherche avec debounce (300ms)
- Filtres : version Minecraft, loader, tri
- Grille de resultats avec badge source (CurseForge/Modrinth)
- Details du mod (description, telechargements, versions)
- Installation vers une instance

### InstanceDetail (`src/pages/InstanceDetail.tsx`)

Gestion d'une instance specifique :
- Infos de l'instance (version, loader, chemin)
- Liste des mods installes
- Ajout/suppression de mods
- Lancement du jeu (avec verification Java)
- Bouton Kill pendant l'execution
- Statut live (Preparing, Running avec PID, Crashed)

### SyncHub (`src/pages/SyncHub.tsx`)

Hub de synchronisation P2P :
- Statut P2P (actif/inactif)
- Bouton Start/Stop P2P
- Generation de share code
- Champ pour entrer un code
- Preview du diff avant sync
- Boutons confirmer/rejeter
- Liste des peers connectes

### Settings (`src/pages/Settings.tsx`)

Parametres de l'application :
- Allocation RAM (slider)
- Options reseau
- Statut Java 21
- Bouton Install / Reinstall Java 21

### JavaSetupModal (`src/components/java/JavaSetupModal.tsx`)

Popup globale affichee au demarrage si Java 21 n'est pas disponible :
- Message bloquant
- Bouton d'installation automatique
- Barre de progression (download / verification / extraction)
- Retry en cas d'erreur

## Composants UI

### Layout

| Composant | Fichier | Role |
|-----------|---------|------|
| TitleBar | `components/layout/TitleBar.tsx` | Barre de titre custom Tauri (minimize, maximize, close, drag) |
| Sidebar | `components/layout/Sidebar.tsx` | Navigation laterale (Home, Browse, Sync, Settings, Profile) |

### Composants de base

| Composant | Fichier | Variants |
|-----------|---------|----------|
| Button | `components/ui/Button.tsx` | primary, secondary, ghost, danger + sizes sm/md/lg |
| Card | `components/ui/Card.tsx` | hoverable, className custom |
| Badge | `components/ui/Badge.tsx` | success, info, warning, danger, default |
| Input | `components/ui/Input.tsx` | label, placeholder, type |
| Modal | `components/ui/Modal.tsx` | open, onClose, title, footer |
| Slider | `components/ui/Slider.tsx` | min, max, step, value, onChange |
| Toggle | `components/ui/Toggle.tsx` | checked, onChange, label |

## Hooks

### useTauriCommand

Hook generique pour appeler une commande Tauri avec gestion automatique de l'etat :

```typescript
function useTauriCommand<T>(
  commandFn: () => Promise<T>
): {
  data: T | undefined;
  loading: boolean;
  error: string | undefined;
  refetch: () => void;
}
```

Usage :
```typescript
const { data: instances, loading, error, refetch } = useTauriCommand(listInstances);
```

### useDebounce

Debounce une valeur pour eviter les appels excessifs (recherche) :

```typescript
function useDebounce<T>(value: T, delay?: number): T
```

Usage :
```typescript
const [search, setSearch] = useState("");
const debouncedSearch = useDebounce(search, 300);
```

### useGameStatus

Hook de lancement et de monitoring :

- pre-download Minecraft avant launch,
- polling `get_game_status`,
- action `kill`,
- persistance de progression download entre pages.

### useJavaRuntime

Hook global (provider) pour Java 21 :
- polling `get_java_status` / `get_java_install_progress`,
- action `installJava`,
- flags `isReady`, `isBlocking`, `isInstalling`.

## Types TypeScript

Les types dans `src/lib/types.ts` sont le miroir exact des structs Rust serialisees. Exemples :

```typescript
interface MinecraftInstance {
  id: string;
  name: string;
  minecraft_version: string;
  loader: ModLoader;
  loader_version: string | undefined;
  instance_path: string;
  total_play_time: number;
  last_played_at: string | undefined;
  is_active: boolean;
}

type ModLoader = "vanilla" | "fabric" | "forge" | "neoforge" | "quilt";

interface VersionEntry {
  id: string;
  version_type: string;
  url: string;
  release_time: string;
}
```

## Wrappers IPC

`src/lib/tauri.ts` contient les wrappers types pour chaque commande Tauri :

```typescript
import { invoke } from "@tauri-apps/api/core";

export function listInstances(): Promise<MinecraftInstance[]> {
  return invoke("list_instances");
}

export function searchMods(filters: SearchFilters): Promise<SearchResponse> {
  return invoke("search_mods", { filters });
}

export function launchInstance(
  instanceId: string,
  javaPath: string
): Promise<LaunchInfo> {
  return invoke("launch_instance", { instanceId, javaPath });
}

export function getJavaStatus(): Promise<JavaRuntimeStatus> {
  return invoke("get_java_status");
}

export function installJavaRuntime(): Promise<JavaInstallResult> {
  return invoke("install_java_runtime");
}
```

## Design System

Le theme est un dark theme coherent :

| Token | Valeur | Usage |
|-------|--------|-------|
| `surface-500` | Gris fonce moyen | Background survol |
| `surface-600` | Gris fonce | Background cartes |
| `surface-700` | Gris tres fonce | Background inputs |
| `border-default` | Gris subtil | Bordures par defaut |
| `border-hover` | Gris clair | Bordures au survol |
| `accent` | Couleur principale | Boutons, liens, focus |
| `zinc-100` | Blanc casse | Texte principal |
| `zinc-400` | Gris moyen | Labels |
| `zinc-500` | Gris | Texte secondaire |
| `zinc-600` | Gris fonce | Texte desactive |

## Routing

```typescript
// src/App.tsx
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/auth" element={<Auth />} />
  <Route path="/browse" element={<BrowseMods />} />
  <Route path="/instance/:id" element={<InstanceDetail />} />
  <Route path="/sync" element={<SyncHub />} />
  <Route path="/settings" element={<Settings />} />
</Routes>
```
