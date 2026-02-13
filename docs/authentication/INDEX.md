# Authentication - Index

## Ce module

- [DOC.md](./DOC.md) - Flow complet d'authentification Microsoft OAuth

## Liens vers les autres modules

| Module | Relation |
|--------|----------|
| [Database](../database/DOC.md) | Stockage des comptes (tokens, UUID, username) |
| [Game Launch](../game-launch/DOC.md) | Utilise le access_token et UUID pour les arguments de lancement |
| [Frontend](../frontend/DOC.md) | Page Auth.tsx pour l'interface du Device Code Flow |

## Fichiers cles

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/auth.rs` | AuthService complet (6 etapes) |
| `src-tauri/src/commands/auth.rs` | start_auth, poll_auth, get_profile, logout, refresh_auth |
| `src-tauri/src/commands/account.rs` | get_active_account, save_account |
| `src/pages/Auth.tsx` | UI du flow de connexion |

## APIs externes

| API | URL | Role |
|-----|-----|------|
| Microsoft OAuth | `login.microsoftonline.com/consumers/oauth2/v2.0/` | Device Code + Token |
| Xbox Live | `user.auth.xboxlive.com/user/authenticate` | XBL token |
| XSTS | `xsts.auth.xboxlive.com/xsts/authorize` | XSTS token |
| Minecraft Services | `api.minecraftservices.com/` | MC token + profil |
