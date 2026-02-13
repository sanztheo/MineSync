# Contributing Guide

Thank you for your interest in contributing to MineSync! This guide will help you get started.

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build something great together.

## Getting Started

### Prerequisites

1. **Development environment:**
   - Node.js >= 18
   - Rust >= 1.77
   - Git

2. **Fork and clone:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/MineSync.git
   cd MineSync
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your CurseForge API key
   ```

5. **Run in development:**
   ```bash
   npm run tauri dev
   ```

## Project Structure

```
MineSync/
├── src/                 # Frontend (React + TypeScript)
├── src-tauri/          # Backend (Rust)
├── wiki/               # Documentation
└── assets/             # Branding assets
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions

### 2. Make Changes

Follow the coding guidelines below for your changes.

### 3. Test Your Changes

```bash
# Run Rust tests
cd src-tauri && cargo test

# Check Rust code
cargo check
cargo clippy

# Run the app
npm run tauri dev
```

### 4. Commit Your Changes

Write clear, concise commit messages:

```bash
git commit -m "Add mod dependency resolution for Modrinth"
```

Commit message format:
- Start with a verb (Add, Fix, Update, Remove, Refactor)
- Keep the first line under 72 characters
- Add details in the body if needed

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Coding Guidelines

### Rust Backend

#### Error Handling

Always use `thiserror` for error types:

```rust
// Good
#[derive(Debug, thiserror::Error)]
pub enum MyError {
    #[error("Failed to connect: {0}")]
    Connection(String),
}

fn my_function() -> Result<(), MyError> {
    // Use ? operator
    some_operation()?;
    Ok(())
}
```

```rust
// Bad - Never use unwrap in production
fn bad_function() {
    let result = some_operation().unwrap(); // NO!
}
```

#### Async Operations

Use `tokio::spawn()` for heavy operations:

```rust
// Good - Non-blocking
pub async fn download_file(url: &str) -> Result<()> {
    tokio::spawn(async move {
        // Heavy I/O operation
    }).await?
}
```

```rust
// Bad - Blocks Tauri thread
pub fn bad_download(url: &str) -> Result<()> {
    std::thread::sleep(Duration::from_secs(10)); // NO!
}
```

#### Concurrency

Use `Arc<Mutex<T>>` for shared state:

```rust
use std::sync::{Arc, Mutex};

pub struct Service {
    state: Arc<Mutex<ServiceState>>,
}

impl Service {
    pub fn update(&self, data: Data) -> Result<()> {
        let mut state = self.state.lock().map_err(|_| Error::Lock)?;
        state.update(data);
        Ok(())
    }
}
```

#### Database Operations

- Always use soft delete (`is_active` flag)
- Generate UUIDs for primary keys
- Use ISO-8601 for timestamps

```rust
// Good
let id = Uuid::new_v4().to_string();
let now = Utc::now().to_rfc3339();

conn.execute(
    "UPDATE items SET is_active = 0, updated_at = ? WHERE id = ?",
    params![now, id],
)?;
```

### TypeScript Frontend

#### IPC Calls

Always use the centralized `lib/tauri.ts`:

```typescript
// Good - lib/tauri.ts
export async function listInstances(): Promise<Instance[]> {
    return invoke<Instance[]>('list_instances');
}

// Usage in component
import { listInstances } from '@/lib/tauri';
const instances = await listInstances();
```

```typescript
// Bad - Direct invoke in component
import { invoke } from '@tauri-apps/api';
const instances = await invoke('list_instances'); // NO!
```

#### Type Definitions

Mirror Rust types exactly in `lib/types.ts`:

```typescript
// types.ts - Must match Rust struct
export interface Instance {
    id: string;
    name: string;
    mc_version: string;
    loader_type: ModLoader;
    // ...
}

export type ModLoader = 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt';
```

#### Components

Use explicit return types and extend HTML attributes:

```typescript
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
}

export function Button({
    variant = 'primary',
    size = 'md',
    children,
    className,
    ...props
}: ButtonProps): ReactNode {
    return (
        <button
            className={cn(baseStyles, variantStyles[variant], className)}
            {...props}
        >
            {children}
        </button>
    );
}
```

#### State Management

Use local state, avoid global state managers:

```typescript
// Good - Local state
function InstanceList(): ReactNode {
    const [instances, setInstances] = useState<Instance[]>([]);
    const [loading, setLoading] = useState(true);
    
    // ...
}
```

### Styling (Tailwind CSS v4)

Use the project's design tokens:

```typescript
// Good - Use theme tokens
<div className="bg-surface-800 text-zinc-100 border border-default">
    <span className="text-accent">Accent text</span>
</div>
```

```typescript
// Bad - Hardcoded colors
<div className="bg-[#1a1a2e] text-[#ffffff]">
    // NO! Use theme tokens
</div>
```

## Adding New Features

### 1. Backend Command

Add command in `src-tauri/src/commands/`:

```rust
// commands/my_feature.rs
use tauri::command;

#[command]
pub async fn my_command(param: String) -> Result<MyResponse, String> {
    // Implementation
}
```

Register in `lib.rs`:

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        // ... existing commands
        commands::my_feature::my_command,
    ])
```

### 2. Frontend Wrapper

Add to `lib/tauri.ts`:

```typescript
export async function myCommand(param: string): Promise<MyResponse> {
    return invoke<MyResponse>('my_command', { param });
}
```

### 3. Types

Add to `lib/types.ts`:

```typescript
export interface MyResponse {
    // ...
}
```

## Testing

### Rust Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_my_function() {
        let result = my_function("input");
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_async_function() {
        let result = async_function().await;
        assert_eq!(result, expected);
    }
}
```

Run tests:
```bash
cd src-tauri && cargo test
```

### Manual Testing

Always test these scenarios:
- [ ] Fresh install (no database)
- [ ] Existing database (migrations)
- [ ] P2P connection (if applicable)
- [ ] Error states (network down, invalid input)

## Documentation

Update documentation when:
- Adding new commands (update API-Reference.md)
- Changing database schema (update Database-Schema.md)
- Modifying P2P protocol (update P2P-Protocol.md)
- Adding new features (update relevant wiki pages)

## Pull Request Guidelines

### PR Title

Format: `type: brief description`

Examples:
- `feat: add mod version filtering by loader`
- `fix: resolve P2P connection timeout issue`
- `docs: update API reference for sync commands`

### PR Description

Include:
1. **What** - What does this PR do?
2. **Why** - Why is this change needed?
3. **How** - How was it implemented?
4. **Testing** - How was it tested?

### Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added/updated (if applicable)
- [ ] Documentation updated (if applicable)
- [ ] No compiler warnings
- [ ] Clippy passes without errors
- [ ] PR has descriptive title and description

## Getting Help

- **Questions?** Open a Discussion on GitHub
- **Found a bug?** Open an Issue
- **Need guidance?** Tag maintainers in your PR

## Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes for significant contributions

Thank you for contributing to MineSync! 🎮
