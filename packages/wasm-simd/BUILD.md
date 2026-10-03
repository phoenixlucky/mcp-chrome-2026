# WASM SIMD build guide

## 🚀 Quick build

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# On the first WASM build the project installs Rust stable, the WASM target and wasm-pack automatically
# If automatic installation is blocked by network/permissions, install them manually:
cargo install wasm-pack --locked
```

### Build options

1. **Build from the project root** (recommended):

   ```bash
   # Build WASM and copy it to the Chrome extension automatically
   pnpm run build:wasm
   ```

2. **Build the WASM package only**:

   ```bash
   # From the packages/wasm-simd directory
   npm run build

   # Or use a pnpm filter from anywhere
   pnpm --filter @chrome-mcp/wasm-simd build
   ```

3. **Development build**:
   ```bash
   npm run build:dev  # unoptimized build, compiles faster
   ```

### Build artifacts

After the build, the `pkg/` directory contains:

- `simd_math.js` - JavaScript bindings
- `simd_math_bg.wasm` - WebAssembly binary
- `simd_math.d.ts` - TypeScript type definitions
- `package.json` - NPM package metadata

### Integrating into the Chrome extension

The WASM files are copied to `app/chrome-extension/workers/` automatically and can be used directly by the Chrome extension:

```typescript
// Use it in the Chrome extension
const wasmUrl = chrome.runtime.getURL('workers/simd_math.js');
const wasmModule = await import(wasmUrl);
```

## 🔧 Development workflow

1. Edit the Rust code in `src/lib.rs`
2. Run `npm run build` to rebuild
3. The Chrome extension picks up the new WASM files automatically

## 📊 Performance testing

```bash
# Run the benchmark in the Chrome extension
import { runSIMDBenchmark } from './utils/simd-benchmark';
await runSIMDBenchmark();
```
