# Code Review — Install flow (mods + modpacks)

> Audit: 2026-02-13 | Scope: Fichiers non-commites | Reviewer: AI Auditor

## Resume
L’integration install (Rust + IPC + UI) est globalement coherente et compile, mais elle introduit une faille de securite critique dans l’extraction d’archives et deux risques fonctionnels moderes qui peuvent laisser l’etat local incoherent. Les dependances impactees touchent le coeur d’execution (DownloadService, DatabaseService, launch runtime).

## Findings

### CRITICAL (Failles secu / Crashs / Data corruption)
- **Zip Slip / ecriture hors dossier cible**: `extract_zip` ne bloque pas les chemins absolus (et ne verifie pas la canonicalisation sous `dest`). Un entry ZIP comme `/tmp/pwned` ou equivalent peut ecrire hors `extract_dir`.  
  Reference: `src-tauri/src/services/install.rs:495`, `src-tauri/src/services/install.rs:500`, `src-tauri/src/services/install.rs:491`

### MODERATE (Bugs potentiels / Race conditions / Perf reelle)
- **Suppression de mod incomplete (DB uniquement)**: `remove_mod` desactive juste la ligne SQL (`is_active = 0`) sans supprimer le `.jar` dans `<instance>/mods`. Le mod reste charge par Minecraft au lancement, donc l’UI indique "removed" alors que le runtime continue a l’executer.  
  References: `src-tauri/src/commands/install.rs:78`, `src-tauri/src/services/database.rs:346`, `src-tauri/src/services/install.rs:71`
- **Creation d’instance non atomique / etat partiel en cas d’echec**: l’instance est creee en DB tres tot, puis plusieurs etapes reseau/disque peuvent echouer apres (`fetch_version_detail`, downloads, loader install). Aucune transaction/rollback/cleanup ne restaure l’etat, donc on garde une instance partiellement installee.  
  References: `src-tauri/src/services/install.rs:185`, `src-tauri/src/services/install.rs:191`, `src-tauri/src/services/install.rs:194`, `src-tauri/src/services/install.rs:202`

### LOW (Style / Suggestions)
Aucun.

### PASS
- Wiring IPC complet et coherent pour le nouveau scope install (`commands/install.rs` expose et `src-tauri/src/lib.rs` enregistre les commandes).
- `cargo check` OK et `npm run lint` OK sur l’arbre courant.
- Renforcement utile du cache download via verification SHA1 avant reutilisation (`src-tauri/src/services/download.rs`).
- `apply_sync` ne marque plus systematiquement un sync en succes si des erreurs existent (`src-tauri/src/commands/sync_protocol.rs`).

## Analyse d'Impact
- **Impact dependances**: le nouveau `InstallService` est maintenant consomme via `commands/install.rs` puis `src/lib/tauri.ts`, et alimente `BrowseMods`, `BrowseModpacks`, `InstanceDetail`, `InstallModModal`, `InstallModpackModal`. Les regressions ici affectent directement UX + runtime local.
- **Charge DB**: l’installation de modpack produit beaucoup d’insertions `instance_mods` (1 par mod). Sans rollback, un echec laisse des ecritures partielles qui polluent les lectures suivantes (`list_instance_mods`) et les parcours sync.
- **Charge reseau/API**: `get_cf_files_batch` reduit correctement le nombre d’appels CurseForge (batch de 100), bon point de scalabilite API.
- **I/O cache**: la verification SHA1 du cache augmente les lectures disque (fichiers entiers) mais reduit le risque de corruption silencieuse.
- **Runtime game**: divergence DB/fichiers lors de `remove_mod` impacte directement l’execution Minecraft (mod toujours present sur disque).

## Verdict
NO-GO
