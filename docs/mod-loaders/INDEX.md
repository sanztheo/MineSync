# Mod Loaders - Index

## Ce module

- [DOC.md](./DOC.md) - Installation et gestion des mod loaders (Fabric, Quilt, Forge, NeoForge)

## Liens vers les autres modules

| Module | Relation |
|--------|----------|
| [Minecraft Engine](../minecraft-engine/DOC.md) | Le loader modifie le classpath et mainClass du client vanilla |
| [Game Launch](../game-launch/DOC.md) | Fusionne le LoaderProfile avec les arguments de lancement |
| [Mod Platforms](../mod-platforms/DOC.md) | Les mods filtrent par loader compatible |
| [Database](../database/DOC.md) | Stocke loader_type et loader_version par instance |

## Fichiers cles

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/loader/mod.rs` | LoaderService (dispatch) |
| `src-tauri/src/services/loader/fabric.rs` | FabricInstaller |
| `src-tauri/src/services/loader/quilt.rs` | QuiltInstaller |
| `src-tauri/src/services/loader/forge.rs` | ForgeInstaller |
| `src-tauri/src/services/loader/neoforge.rs` | NeoForgeInstaller |
| `src-tauri/src/commands/loader.rs` | list_loader_versions, install_loader |

## APIs externes

| Loader | API | Type |
|--------|-----|------|
| Fabric | `meta.fabricmc.net` | REST JSON |
| Quilt | `meta.quiltmc.org` | REST JSON |
| Forge | `maven.minecraftforge.net` | Maven repository |
| NeoForge | `maven.neoforged.net` | Maven repository |
