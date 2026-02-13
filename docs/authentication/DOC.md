# Authentication - Microsoft OAuth

## Vue d'ensemble

MineSync utilise le **Device Code Flow** de Microsoft OAuth 2.0 pour authentifier les joueurs. Ce flow est ideal pour les applications desktop car il ne necessite pas de serveur web local ni de redirection de navigateur.

## Fichiers concernes

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/auth.rs` | AuthService - logique d'authentification complete |
| `src-tauri/src/commands/auth.rs` | Commands IPC (start_auth, poll_auth, etc.) |
| `src-tauri/src/commands/account.rs` | Persistence du compte (get_active_account, save_account) |
| `src/pages/Auth.tsx` | Interface utilisateur du flow de connexion |
| `src/lib/tauri.ts` | Wrappers startAuth, pollAuth, getProfile, logout, refreshAuth |

## Flow d'authentification complet

Le flow comporte 6 etapes chainées :

### Etape 1 : Device Code Request

```
POST https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode
Content-Type: application/x-www-form-urlencoded

client_id={CLIENT_ID}&scope=XboxLive.signin%20offline_access
```

**Reponse :** `user_code` (ex: "A1B2C3D4") + `verification_uri` (microsoft.com/link) + `device_code` + `expires_in`

L'utilisateur voit le code et va sur le site pour le saisir.

### Etape 2 : Poll for Token

```
POST https://login.microsoftonline.com/consumers/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:device_code
&client_id={CLIENT_ID}
&device_code={DEVICE_CODE}
```

Le frontend poll toutes les 3 secondes. Les reponses possibles :
- `authorization_pending` -> continuer le polling
- `access_token` + `refresh_token` -> succes, passer a l'etape 3
- `expired_token` -> le code a expire, recommencer
- Autre erreur -> arreter

### Etape 3 : Xbox Live Authentication

```
POST https://user.auth.xboxlive.com/user/authenticate
Content-Type: application/json

{
  "Properties": {
    "AuthMethod": "RPS",
    "SiteName": "user.auth.xboxlive.com",
    "RpsTicket": "d={MS_ACCESS_TOKEN}"
  },
  "RelyingParty": "http://auth.xboxlive.com",
  "TokenType": "JWT"
}
```

**Reponse :** `Token` (XBL token) + `DisplayClaims.xui[0].uhs` (user hash)

### Etape 4 : XSTS Authorization

```
POST https://xsts.auth.xboxlive.com/xsts/authorize
Content-Type: application/json

{
  "Properties": {
    "SandboxId": "RETAIL",
    "UserTokens": ["{XBL_TOKEN}"]
  },
  "RelyingParty": "rp://api.minecraftservices.com/",
  "TokenType": "JWT"
}
```

**Reponse :** `Token` (XSTS token)

### Etape 5 : Minecraft Token

```
POST https://api.minecraftservices.com/authentication/login_with_xbox
Content-Type: application/json

{
  "identityToken": "XBL3.0 x={USER_HASH};{XSTS_TOKEN}"
}
```

**Reponse :** `access_token` (MC token) + `expires_in`

### Etape 6 : Profil Minecraft

```
GET https://api.minecraftservices.com/minecraft/profile
Authorization: Bearer {MC_ACCESS_TOKEN}
```

**Reponse :** `id` (UUID sans tirets) + `name` (username)

Le UUID est reformate avec tirets (format standard) avant stockage.

## Refresh Token

Quand le token expire, le `refresh_token` Microsoft stocke en base est utilise pour obtenir un nouveau jeu de tokens sans refaire tout le flow :

```
POST .../token
grant_type=refresh_token
&client_id={CLIENT_ID}
&refresh_token={STORED_REFRESH_TOKEN}
&scope=XboxLive.signin offline_access
```

Puis la chaine Xbox Live -> XSTS -> Minecraft -> Profil est rejouee.

## Stockage

Les tokens sont stockes dans la table `accounts` (SQLite) :

| Champ | Contenu |
|-------|---------|
| `username` | Nom du joueur Minecraft |
| `uuid` | UUID Minecraft (format avec tirets) |
| `access_token` | Token Minecraft (pour lancer le jeu) |
| `refresh_token` | Token Microsoft (pour renouveler) |
| `expires_at` | Date d'expiration du token MC |
| `is_active` | 1 pour le compte actif, 0 pour les autres |

## Struct PendingAuth

Le service maintient un etat `PendingAuth` pendant le flow :

```rust
struct PendingAuth {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_at: chrono::DateTime<chrono::Utc>,
}
```

Cela permet au frontend de poll sans redemander le device code.

## Interface utilisateur

La page `Auth.tsx` affiche :
1. Bouton "Se connecter" -> demarre le flow
2. Le code utilisateur + lien microsoft.com/link
3. Spinner de polling avec message "En attente de connexion..."
4. En cas de succes : profil du joueur (nom + UUID) + bouton Deconnexion
