# OneKey CLI Design Spec v2

> Date: 2026-03-20
> Status: Draft
> Supersedes: `.plans/2026-03-12-onekey-cli-design.md`
> Target: `packages/cli/` in app-monorepo
> Reference implementation: `/Users/leon/Downloads/onekey-cli/` (colleague's BMAD demo)

---

## 1. What We're Building

A TypeScript CLI tool for OneKey wallet operations — balance queries, transfers, swaps, and staking. It lives inside the OneKey monorepo as `packages/cli/`, uses `@onekeyhq/core` for all cryptographic operations, and calls the same backend APIs that the existing apps (desktop/mobile/web/ext) use.

### Design Principles

1. **CLI is stateless** — no database, no persistent state beyond Keychain-encrypted mnemonic
2. **Layered signing** — signing delegated to pluggable `ISigner` via `@onekeyhq/core`
3. **Triple output mode** — `human` (TTY default), `agent` (JSON, pipe default), `quiet` (minimal value only)
4. **Test-first** — default to `onekeytest.com`, production opt-in via `--env prod`
5. **EVM-first, multi-chain ready** — MVP ships EVM only; architecture supports adding SOL/BTC/etc. via `@onekeyhq/core`'s `coreChainApi.{impl}` pattern
6. **Fail with guidance** — every error includes `code`, `message`, and `suggestion`
7. **Self-contained distribution** — full bundle via tsup, published to npm as the only non-private package in monorepo
8. **Security and business logic must be tested** — crypto, signing, exit codes, output contracts require test coverage; not every file needs a test

### Key Changes from v1 Spec

| Area | v1 Spec | v2 Spec | Rationale |
|------|---------|---------|-----------|
| Chain scope | EVM + SOL + BTC | EVM-only MVP | Validate full pipeline first, add chains later |
| Signing | `@onekeyhq/core` | `@onekeyhq/core` (unchanged) | Unified crypto layer, risk-aware |
| Data queries | Direct RPC via Axios | OneKey backend API (wallet/swap/earn services) | Multi-chain compat, stable, reuses service layer logic |
| RPC library | viem considered | Not used | No direct RPC; queries go through OneKey API |
| Keychain | keytar (npm) | macOS `security` CLI command | keytar is archived; zero native deps |
| Encryption | None (plaintext in Keychain) | scrypt + AES-256-GCM with random secret | Defense in depth |
| Output mode | Dual (human / --json) | Triple (human / agent / quiet) + TTY auto-detect | Pipe-friendly; demo validated |
| Error handling | `try/catch → exit 1` | Graded exit codes (0-5) + `AppError` | Agent-friendly; precise retry logic |
| Proxy | Not mentioned | Read `https_proxy` env var | Debug with Charles/Proxyman |
| Phases | 6 phases (P0-P5) | 4 phases (P0-P3) | Each phase delivers usable commands |
| Distribution | Not specified | Full bundle → npm publish (`private: false`) | First externally published package in monorepo |
| Validation | Not specified | Zod schemas per command | Bundled into CLI, no monorepo-wide impact |
| Test framework | Not specified | Jest (monorepo standard) | Consistency with existing test infra |
| Test strategy | Not specified | P0/P1/P2 priority matrix, security-first | Crypto + signing + business logic must be covered |

---

## 2. Reference Materials

### Primary: Colleague's BMAD Demo

Path: **`/Users/leon/Downloads/onekey-cli/`**

Validated code to borrow directly (see Section 8):

| Module | Files | What to Borrow |
|--------|-------|---------------|
| Error system | `errors/error-codes.ts`, `errors/app-error.ts` | Exit code mapping, `AppError` class, `AppError.from()` |
| Output system | `output/output-formatter.ts`, `output/json-formatter.ts`, `output/human-formatter.ts` | Triple-mode formatting, `SuccessResponse`/`ErrorResponse` envelopes |
| Mode detection | `utils/mode-detector.ts` | TTY auto-detect logic |
| Logger | `utils/logger.ts` | `sanitize()` for private key/mnemonic redaction |
| Tx confirmation | `utils/confirm-transaction.ts` | Confirmation prompt, `--yes` skip, agent-mode auto-skip |
| Keychain | `infra/keychain-storage.ts` | macOS `security` CLI wrapper, error mapping |
| Crypto | `core/crypto-utils.ts` | scrypt + AES-256-GCM encrypt/decrypt, `secureWipe()` |
| Secure cache | `core/secure-cache.ts` | TTL-based in-memory cache with SIGINT cleanup |
| Config | `config/config-manager.ts` | YAML config + env var + CLI override layering |
| Zod schemas | `schemas/*.ts` | Per-command input validation pattern |
| Shell completion | `core/completion-generator.ts` | bash/zsh/fish completion generation |

### Secondary: Bitget CLI

Path: **`/Users/leon/Documents/github/wallet-agents/competitors/bitget-cli/`**

| File | What to Learn |
|------|--------------|
| `bgw/cli.py` | Command structure, `--json` mode, error handling |
| `bgw/api.py` | Request/response flow, timeout handling |
| `bgw/format.py` | Price/volume/change formatting with adaptive precision |

### OneKey Monorepo References

| Package | What It Provides for CLI |
|---------|------------------------|
| `packages/core/src/secret/` | `revealableSeedFromMnemonic()`, BIP-39 |
| `packages/core/src/chains/evm/CoreChainSoftware.ts` | EVM address derivation + signing |
| `packages/core/src/instance/coreChainApi.ts` | Entry point: `coreChainApi.evm.hd.*` |
| `packages/shared/src/config/appConfig.ts` | Host constants: `onekeycn.com`, `onekeytest.com` |
| `packages/shared/src/config/endpointsMap.ts` | `buildServiceEndpoint()` URL construction |
| `packages/shared/src/request/Interceptor.ts` | OneKey request headers |
| `packages/shared/types/endpoint.ts` | `IEndpointEnv = 'test' | 'prod'` |
| `packages/kit-bg/src/services/ServiceAccountProfile.ts` | Balance, account info queries via API |
| `packages/kit-bg/src/services/ServiceSwap.ts` | Swap quote/build/execute flow |
| `packages/kit-bg/src/services/ServiceSend.ts` | Transaction broadcast |

---

## 3. Architecture

```
apps/cli/
├── src/
│   ├── commands/              # Layer 1: Command handlers
│   │   ├── import.ts              import mnemonic wallet
│   │   ├── logout.ts              clear wallet from Keychain
│   │   ├── balance.ts             query balances via OneKey API
│   │   ├── transfer.ts            build + sign + broadcast native/ERC-20
│   │   ├── swap.ts                quote + approve + execute
│   │   ├── staking.ts             stake / unstake / claim / status
│   │   ├── completion.ts          shell completion generator
│   │   └── status.ts              system status / connectivity check
│   ├── core/                  # Layer 2: Business logic
│   │   ├── crypto-utils.ts        scrypt + AES-256-GCM encrypt/decrypt
│   │   ├── secure-cache.ts        TTL in-memory cache with secure wipe
│   │   └── transaction-builder.ts build unsigned tx → sign via ISigner → broadcast
│   ├── signer/                # Layer 3: Signing (vaults-style architecture)
│   │   ├── base/
│   │   │   └── SignerBase.ts      Common: read Keychain → decrypt → getHdCredential()
│   │   ├── impls/
│   │   │   └── evm/
│   │   │       └── EvmSigner.ts   EVM: template, networkInfo, scope lazy-load
│   │   │   # Future: sol/, btc/ etc.
│   │   ├── factory.ts             getSignerByImpl(impl) → lazy-load impl signer
│   │   ├── types.ts               ISigner interface (multi-chain ready)
│   │   └── index.ts               Barrel export
│   ├── infra/                 # Layer 4: Infrastructure
│   │   ├── api-client.ts          OneKey API client (Axios, env switching, auto headers)
│   │   └── keychain-storage.ts    macOS `security` CLI wrapper
│   ├── errors/                # Error system
│   │   ├── error-codes.ts         EXIT_CODES enum + prefix mapping
│   │   └── app-error.ts           AppError class (code + message + suggestion)
│   ├── output/                # Output formatting
│   │   ├── output-formatter.ts    Triple-mode dispatcher
│   │   ├── json-formatter.ts      Agent mode: { status, api_version, data, metadata }
│   │   └── human-formatter.ts     Human mode: chalk-formatted tables
│   ├── schemas/               # Input validation (Zod)
│   │   ├── transfer-schema.ts
│   │   ├── swap-schema.ts
│   │   └── ...
│   ├── config/                # Configuration
│   │   ├── index.ts               IEndpointEnv, getHost(), chain map
│   │   ├── config-manager.ts      ~/.onekey/config.yaml + env vars + CLI overrides
│   │   └── defaults.ts            DEFAULT_CONFIG
│   ├── utils/                 # Utilities
│   │   ├── logger.ts              Graded stderr logger with sanitize()
│   │   ├── mode-detector.ts       TTY auto-detect → OutputMode
│   │   └── confirm-transaction.ts Interactive confirmation prompt
│   ├── types/                 # TypeScript types
│   │   ├── index.ts
│   │   └── onekey-api.ts          OneKey API request/response types
│   └── cli.ts                 # Entry point (commander.js)
├── bin/
│   └── onekey                 # Executable shebang wrapper
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### Layer Responsibilities

```
User Input (CLI args)
    │
    ▼
commands/*.ts          Parse args (Zod) → call API → format output
    │
    ├──▶ infra/api-client.ts    HTTP calls to OneKey backend (wallet/swap/earn)
    │                           Pattern: packages/shared/src/appApiClient/
    │
    ├──▶ signer/                Transaction signing via @onekeyhq/core
    │                           ISigner interface → keychain-signer implementation
    │
    ├──▶ output/                Triple-mode output (human/agent/quiet)
    │
    └──▶ errors/                Graded exit codes + structured errors
```

### Multi-Chain Architecture (EVM-first, vaults-style)

The signer layer follows the same pattern as `packages/kit-bg/src/vaults/`:
- `base/` — common logic (Keychain read, decrypt, hdCredential)
- `impls/{impl}/` — chain-specific logic (template, networkInfo, scope lazy-load)
- `factory.ts` — routes `impl` string to the correct signer implementation

```typescript
// signer/types.ts — chain-agnostic interface
interface ISigner {
  getAddress(networkId: string): Promise<ICoreApiGetAddressItem>;
  signTransaction(payload: ICoreApiSignTxPayload): Promise<ISignedTxPro>;
  signMessage(payload: ICoreApiSignMsgPayload): Promise<string>;
}

// signer/factory.ts — lazy-load signer by impl
async function getSignerByImpl(impl: string): Promise<ISigner> {
  switch (impl) {
    case 'evm':
      return new (await import('./impls/evm/EvmSigner')).EvmSigner();
    // Future:
    // case 'sol':
    //   return new (await import('./impls/sol/SolSigner')).SolSigner();
    default:
      throw new AppError(...);
  }
}

// signer/impls/evm/EvmSigner.ts — EVM-specific
class EvmSigner extends SignerBase implements ISigner {
  // Lazy-load CoreChainEvm scope (avoids bundling all chain SDKs)
  private async getScope() {
    return new (await import('@onekeyhq/core/src/chains/evm')).default();
  }
  // EVM template: "m/44'/60'/0'/0/$$INDEX$$"
  // EVM networkInfo: { networkChainCode: 'evm', chainId, networkImpl: 'evm', networkId }
}

// config/index.ts — chain registry (MVP: EVM only)
const CHAINS: Record<string, { networkId: string; impl: string }> = {
  eth:      { networkId: 'evm--1',     impl: 'evm' },
  bsc:      { networkId: 'evm--56',    impl: 'evm' },
  polygon:  { networkId: 'evm--137',   impl: 'evm' },
  arbitrum: { networkId: 'evm--42161', impl: 'evm' },
  base:     { networkId: 'evm--8453',  impl: 'evm' },
  optimism: { networkId: 'evm--10',    impl: 'evm' },
  // Future: sol, btc, etc. — just add entries
};
```

**Adding a new chain requires:**
1. Create `signer/impls/{impl}/{Impl}Signer.ts` with chain-specific template/networkInfo/scope
2. Add `case '{impl}'` in `signer/factory.ts`
3. Add chain entries in `config/index.ts` CHAINS map
4. No command-layer changes needed — commands call `getSignerByImpl(chainConfig.impl)`

**Dynamic import for bundle optimization:** Each chain's `@onekeyhq/core/src/chains/{impl}` is loaded via `await import()` only when that chain is actually used. Unused chains add zero bytes to the bundle.

---

## 4. Key Technical Decisions

### 4.1 Crypto Layer: `@onekeyhq/core` Only

All cryptographic operations — mnemonic handling, address derivation, transaction signing, message signing — go through `@onekeyhq/core`. No viem, no ethers, no direct RPC.

```typescript
// Address derivation
const hdCredential = await revealableSeedFromMnemonic(mnemonic, CLI_PASSWORD);
const result = await coreChainApi.evm.hd.getAddressesFromHd({
  networkInfo: { networkChainCode: 'eth', chainId: '1', networkImpl: 'evm', networkId: 'evm--1' },
  template: "m/44'/60'/0'/0/{index}",
  hdCredential,
  password: CLI_PASSWORD,
  indexes: [0],
});

// Transaction signing
const signed = await coreChainApi.evm.hd.signTransaction({
  networkInfo, password: CLI_PASSWORD,
  credentials: { hd: hdCredential },
  account: { address, path, pub },
  unsignedTx: { encodedTx },
});
```

**Why not viem:** CLI queries go through OneKey API, not direct RPC. Signing goes through `@onekeyhq/core`. There is no role for viem in this architecture.

### 4.2 Data Queries: OneKey Backend API

Balance, token info, fee estimation, swap quotes, staking — all go through OneKey's backend services, same endpoints the app uses. No direct RPC calls to public nodes.

```typescript
// URL pattern: https://{service}.{host}/{path}
// test: https://wallet.onekeytest.com/wallet/v1/account/get-account
// prod: https://wallet.onekeycn.com/wallet/v1/account/get-account

// Services used by CLI:
// wallet.{host}  — balance, account info, fee estimation, tx broadcast
// swap.{host}    — swap quote (SSE), build-tx, state-tx
// earn.{host}    — staking protocols, stake/unstake/claim, overview
```

**Why not direct RPC:** Public RPC nodes are unreliable, each chain needs different client setup, and OneKey API already handles multi-chain routing via `networkId`.

### 4.3 Password for `@onekeyhq/core`

Core's API requires a password for AES encryption of `hdCredential` in memory. In CLI context, a real password adds zero security (mnemonic is already encrypted in Keychain separately).

```typescript
export const CLI_PASSWORD = 'onekey';
```

**Why not empty string:** Core throws `IncorrectPassword` at `aes256.ts:170` when `!password`.

### 4.4 Keychain Storage

macOS `security` CLI command (zero native dependencies, replaces archived `keytar`):

```typescript
// infra/keychain-storage.ts
const SERVICE = 'onekey-cli';

// Keychain entries (multi-wallet ready):
// onekey-cli / wallet:default/encryption-key  →  random 32-byte secret
// onekey-cli / wallet:default/mnemonic        →  AES-256-GCM encrypted mnemonic

// MVP hardcodes wallet name:
const WALLET_NAME = 'default';
const MNEMONIC_KEY = `wallet:${WALLET_NAME}/mnemonic`;
const ENCRYPTION_KEY = `wallet:${WALLET_NAME}/encryption-key`;
```

**Encryption flow:**
1. First import: generate random 32-byte secret → store in Keychain as `encryption-key`
2. Encrypt mnemonic with scrypt(secret) + AES-256-GCM → store as `mnemonic`
3. On use: read both from Keychain → decrypt → derive → sign → `secureWipe()` all buffers

**Future multi-wallet:** Change `WALLET_NAME` from constant to `--wallet <name>` CLI parameter. Keychain key format already supports it.

### 4.5 Output System

Three modes, auto-detected from TTY state:

```typescript
// utils/mode-detector.ts
function detectOutputMode(options): OutputMode {
  if (options.quiet) return 'quiet';
  if (options.json) return 'agent';
  if (options.interactive) return 'human';
  return process.stdout.isTTY ? 'human' : 'agent';
}
```

| Mode | When | stdout | stderr |
|------|------|--------|--------|
| `human` | TTY terminal | Chalk-formatted tables | Logs, warnings, confirmations |
| `agent` | Piped / `--json` | `{ status, api_version, data, metadata }` | Logs (if `--verbose`) |
| `quiet` | `--quiet` | First meaningful value only | Error code + message only |

**Agent mode JSON envelope:**
```json
{
  "status": "success",
  "api_version": "1",
  "data": { "address": "0x...", "balance": "1.5" },
  "metadata": { "chain": "ethereum", "duration_ms": 234, "timestamp": "2026-03-20T..." }
}
```

### 4.6 Error System

Graded exit codes with structured errors:

```typescript
const EXIT_CODES = {
  SUCCESS: 0,   // ok
  BIZ: 1,       // business error (insufficient balance, tx reverted)
  PARAM: 2,     // parameter error (invalid address, missing required)
  NET: 3,       // network error (timeout, unreachable)
  AUTH: 4,      // auth error (no wallet, invalid API key)
  SEC: 5,       // security error (Keychain locked, decryption failed)
};

class AppError extends Error {
  code: string;       // machine-readable: 'PARAM_INVALID_ADDRESS'
  message: string;    // human-readable: 'Invalid Ethereum address: 0xZZZ'
  suggestion: string; // actionable: 'Check the --to address is a valid 0x-prefixed hex string'
  exitCode: number;   // derived from code prefix
}
```

**Log sanitization:** All logger output passes through `sanitize()` which regex-replaces private keys (`0x[a-fA-F0-9]{64}`) and mnemonics (`\b([a-z]{3,8} ){11,23}[a-z]{3,8}\b`) with `[REDACTED]`.

### 4.7 Transaction Confirmation

All fund-moving commands (transfer, swap, staking) show a confirmation prompt in human mode:

```
⚠ Transaction Summary
  Action:  Transfer 1.5 ETH
  To:      0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18
  Network: ethereum

Proceed? (y/N):
```

Rules:
- **Human mode**: prompt shown, waits for `y/yes`
- **Agent mode**: auto-skip (no interactive input expected)
- **`--yes` flag**: skip in all modes
- **`--dry-run` flag**: show tx preview, don't execute (per-command, not global)

### 4.8 Proxy Support

Read standard proxy environment variables for HTTP client (Axios):

```typescript
// Minimal proxy support — read env vars only
// Users set: export https_proxy=http://127.0.0.1:8888
// Useful for debugging with Charles/Proxyman
```

No system proxy auto-detection, no custom CA handling. Document in README.

### 4.9 Chain ID Mapping

```typescript
const CHAINS: Record<string, { networkId: string; impl: string }> = {
  eth:      { networkId: 'evm--1',     impl: 'evm' },
  bsc:      { networkId: 'evm--56',    impl: 'evm' },
  polygon:  { networkId: 'evm--137',   impl: 'evm' },
  arbitrum: { networkId: 'evm--42161', impl: 'evm' },
  base:     { networkId: 'evm--8453',  impl: 'evm' },
  optimism: { networkId: 'evm--10',    impl: 'evm' },
};
```

**`--chain` is always required.** No default chain. Explicit is better than implicit.

Reference: `packages/shared/src/config/presetNetworks.ts` for the full registry.

### 4.10 Signing Flow

```
onekey transfer --chain eth --to 0x... --amount 0.1
    │
    ▼
1. commands/transfer.ts: parse args (Zod), resolve chain config
2. signer/factory.ts: getSignerByImpl('evm') → lazy-load EvmSigner
3. Confirm transaction (human mode prompt, --yes skips)
4. infra/api-client.ts: call OneKey wallet API to estimate fee
5. signer/impls/evm/EvmSigner.ts:
   a. SignerBase.getHdCredential():
      - Read encryption-key + encrypted mnemonic from Keychain
      - Decrypt mnemonic (AES-256-GCM)
      - revealableSeedFromMnemonic(mnemonic, CLI_PASSWORD)
   b. Lazy-load CoreChainEvm scope: await import('@onekeyhq/core/src/chains/evm')
   c. evmScope.hd.signTransaction(payload)
   d. secureWipe() all buffers
6. infra/api-client.ts: broadcast signed tx via wallet API
7. output/: format result (human table or JSON envelope)
```

---

## 5. Global CLI Flags

```
onekey <command> [command-options] [global-flags]

Global flags:
  --json            Force JSON output (agent mode)
  --interactive     Force human mode (override TTY detection)
  --quiet           Minimal output (first value only)
  --verbose         Debug logging to stderr
  --yes             Skip all confirmation prompts
  --env <env>       Environment: test | prod (default: test)
  --chain <chain>   Target chain (required for chain-specific commands)
  --help            Show help
  --version         Show version

Per-command flags:
  --dry-run         Preview without executing (transfer, swap, staking)
  --rpc-url <url>   Custom RPC endpoint (future, not MVP)
```

---

## 6. Phases

### Phase 0: Scaffolding + Infrastructure

**Goal:** Working CLI skeleton with build pipeline, error handling, output system, API client, config.

**Delivers:**
- `packages/cli/` directory structure
- `package.json` (`private: false`) with deps: `commander`, `axios`, `chalk`, `zod`, `yaml`
- `@onekeyhq/core` and `@onekeyhq/shared` as workspace deps
- tsup build config (esbuild, `noExternal: [/.*/]`, target Node.js)
- **Bundle validation:** verify `@onekeyhq/core` and `@onekeyhq/shared` fully bundle without native addon errors
- `bin/onekey` executable
- Triple-mode output system (human/agent/quiet + TTY auto-detect)
- Graded error system (exit codes 0-5, `AppError`)
- Logger with `sanitize()` redaction
- Config system (`~/.onekey/config.yaml` + env vars)
- API client (Axios factory, env switching test/prod, OneKey request headers)
- All global flags working
- First commands: `onekey version`, `onekey status`
- Jest test config (`packages/cli/jest.config.ts`)
- Test infrastructure: mock API factory, mock Keychain storage

**Tests:**
- Output formatter: all 3 modes
- Error code mapping: prefix → exit code
- Config: file + env var + override layering
- Logger: sanitize private keys and mnemonics
- API client: env switching, header injection, error unwrapping

**Acceptance criteria:**
```bash
cd packages/cli && yarn build
./bin/onekey version                      # onekey-cli v0.0.1
./bin/onekey --json version               # {"status":"success","data":{"version":"0.0.1",...}}
./bin/onekey --env prod status            # checks connectivity to prod API
./bin/onekey --help                       # shows all global flags
```

**Dependencies:** None.

---

### Phase 1: Wallet + Read-Only Queries

**Goal:** Import wallet, derive addresses, query balances via OneKey API.

**Delivers:**
- `infra/keychain-storage.ts` — macOS `security` command wrapper
- `core/crypto-utils.ts` — scrypt + AES-256-GCM encrypt/decrypt, `secureWipe()`
- `core/secure-cache.ts` — TTL in-memory buffer cache with SIGINT cleanup
- `signer/types.ts` — `ISigner` interface (multi-chain ready)
- `signer/keychain-signer.ts` — read Keychain → decrypt → `@onekeyhq/core` derive
- Commands:
  - `onekey import --mnemonic` — interactive prompt (hidden input), encrypt + store
  - `onekey logout` — clear wallet from Keychain
  - `onekey balance --chain <chain>` — query via OneKey wallet API

**Key design notes:**
- Mnemonic via interactive prompt (readline), NEVER as CLI argument (`ps` visible)
- Pipe support: `echo "word1 word2 ..." | onekey import --mnemonic`
- Keychain keys: `wallet:default/encryption-key` + `wallet:default/mnemonic`
- Balance query goes to `GET /wallet/v1/account/get-account?networkId=evm--1&accountAddress=0x...&withNetWorth=true`

**Tests:**
- Mnemonic-to-address derivation against known BIP-39 test vectors
- Encrypt/decrypt round-trip
- Keychain mock (store/retrieve/delete)
- Balance command with mocked API response

**Acceptance criteria:**
```bash
onekey import --mnemonic                  # prompts, imports, shows address
onekey balance --chain eth                # shows ETH balance
onekey balance --chain eth --json         # {"status":"success","data":{"balance":"1.5",...}}
onekey logout                             # clears wallet
```

**Dependencies:** Phase 0.

---

### Phase 2: Signer Refactor + Signing + Transfer

**Goal:** Refactor signer to vaults-style architecture, implement transaction signing, add transfer command.

**Delivers:**

**Signer refactor (vaults-style):**
- `signer/base/SignerBase.ts` — common Keychain read + decrypt + hdCredential logic (extracted from current `keychain-signer.ts`)
- `signer/impls/evm/EvmSigner.ts` — EVM-specific: template, networkInfo, lazy-loaded `CoreChainEvm` scope, `getAddress()` + `signTransaction()` + `signMessage()`
- `signer/factory.ts` — `getSignerByImpl(impl)` with dynamic `import()` for bundle optimization
- `signer/types.ts` — updated `ISigner` with full `signTransaction()` + `signMessage()` signatures
- Delete old `signer/keychain-signer.ts` — replaced by base + impls

**Transaction confirmation:**
- `utils/confirm-transaction.ts` — interactive prompt in human mode, auto-skip in agent mode, `--yes` flag

**Transfer command:**
- `onekey transfer --chain <chain> --to <addr> --amount <n>` — native token
- `onekey transfer --chain <chain> --to <addr> --amount <n> --token <contract>` — ERC-20
- Both support `--dry-run` and `--yes`

**Key design notes:**
- Amount input is human-readable (`0.1` = 0.1 ETH), CLI converts to wei
- Fee estimation via OneKey API (`POST /wallet/v1/account/estimate-fee`)
- Tx broadcast via OneKey API (`POST /wallet/v1/account/send-transaction`)
- `--dry-run`: estimate fee, show summary, don't sign or broadcast
- Always `secureWipe()` mnemonic/hdCredential buffers in `finally` block
- EVM scope loaded via `await import('@onekeyhq/core/src/chains/evm')` — not top-level import
- `import` and `balance` commands updated to use `getSignerByImpl()` instead of old `KeychainSigner`

**Tests:**
- Sign known EVM transaction, verify signature
- Native transfer end-to-end (mocked API)
- ERC-20 transfer with decimals lookup
- Confirmation prompt: skip with `--yes`, auto-skip in agent mode
- Dry-run: verify no broadcast call made
- Factory: `getSignerByImpl('evm')` returns EvmSigner, unknown impl throws

**Acceptance criteria:**
```bash
onekey transfer --chain eth --to 0x... --amount 0.01 --dry-run
# Shows: action, to, amount, estimated gas, chain

onekey transfer --chain eth --to 0x... --amount 0.01 --yes
# Broadcasts and prints tx hash

# Existing commands still work after refactor:
onekey import --mnemonic
onekey balance --chain eth
onekey logout
```

**Dependencies:** Phase 1.

---

### Phase 3: Swap + Staking

**Goal:** DEX swap and staking operations via OneKey API.

**Delivers:**
- Commands:
  - `onekey swap --chain <chain> --from <symbol> --to <symbol> --amount <n>`
  - `onekey staking --action <stake|unstake|claim|status> --symbol <symbol> --chain <chain>`
  - Both support `--dry-run` and `--yes`

**Key design notes:**
- Swap flow: resolve token symbols → SSE quote → check allowance → approve if needed → build-tx → sign → broadcast → report
- Staking flow: validate protocol → build tx → sign → broadcast
- Swap quote endpoint uses SSE (`GET /swap/v1/quote/events`)
- Slippage default: 0.5% (configurable via `--slippage`)

**Tests:**
- Swap quote parsing (SSE mock)
- Allowance check + approve flow
- Staking status query
- End-to-end swap with mocked API

**Acceptance criteria:**
```bash
onekey swap --chain eth --from ETH --to USDC --amount 0.1 --dry-run
# Shows: from_token, to_token, amount_in, amount_out, provider, slippage

onekey staking --action status --symbol ETH --chain eth
# Shows: total staked, earnings, claimable
```

**Dependencies:** Phase 2.

---

## 7. Dependency Graph

```
Phase 0 (scaffolding + infrastructure)
   │
   └──▶ Phase 1 (wallet + balance)
           │
           └──▶ Phase 2 (signing + transfer)
                   │
                   └──▶ Phase 3 (swap + staking)
```

Strictly sequential — each phase builds on the previous. No parallelization in MVP.

---

## 8. What to Borrow from Demo

The colleague's demo at `/Users/leon/Downloads/onekey-cli/` has validated many patterns. Borrow these directly, adapting for monorepo integration:

### Direct Transplant (adapt minimally)
1. **Error codes** — `EXIT_CODES` enum, prefix-based mapping, `AppError` class
2. **Output formatter** — `OutputFormatter` class, JSON envelope structure
3. **Mode detector** — TTY auto-detect logic
4. **Logger** — `sanitize()` regex for private keys and mnemonics
5. **Tx confirmation** — `confirmTransaction()` with `--yes` skip
6. **Keychain storage** — macOS `security` command wrapper with error mapping
7. **Crypto utils** — scrypt + AES-256-GCM, `secureWipe()`, `secureAllocAndCopy()`
8. **Secure cache** — TTL-based `Map` with `SIGINT`/`SIGTERM` cleanup
9. **Zod schemas** — Per-command validation pattern
10. **Shell completion** — bash/zsh/fish generator from commander definitions

### Rewrite for Monorepo
1. **RPC client** — Remove (queries go through OneKey API, not direct RPC)
2. **viem usage** — Remove (signing via `@onekeyhq/core`, no viem)
3. **API client** — Replace with OneKey `appApiClient` pattern + env switching
4. **Build config** — Adapt tsup for yarn workspace
5. **Package manager** — pnpm → yarn

---

## 9. Distribution

### Strategy: Full Bundle → npm Publish

The monorepo has no independently published packages (all `private: true`). CLI is the first package to be distributed externally.

**Approach:** tsup with `noExternal: [/.*/]` bundles `@onekeyhq/core`, `@onekeyhq/shared`, and all dependencies into a single self-contained file. The published npm package has zero workspace dependencies.

```bash
# User installation
npm install -g @onekeyhq/cli
onekey version
```

**Build pipeline:**
```
src/cli.ts → tsup (esbuild, noExternal) → dist/onekey.js (single file, ~TBD MB)
                                            ↓
                                       npm publish @onekeyhq/cli
                                       (private: false, only package in monorepo)
```

**Phase 0 validation required:** Verify `@onekeyhq/core` and `@onekeyhq/shared` can be fully bundled by esbuild (no native addons, no dynamic requires that break bundling). If bundling fails, fallback to GitHub Releases binary (Node.js SEA or `pkg`).

**package.json for distribution:**
```json
{
  "name": "@onekeyhq/cli",
  "version": "0.1.0",
  "private": false,
  "bin": { "onekey": "./dist/onekey.js" },
  "files": ["dist/", "bin/"]
}
```

---

## 10. Testing Strategy

### Framework: Jest (monorepo standard)

The monorepo uses Jest. CLI follows the same framework for consistency. No vitest.

### Validation: Zod (CLI-internal)

CLI uses Zod for per-command input validation. Zod is bundled into the CLI output and does not leak to other monorepo packages. This is a CLI implementation detail, not a monorepo-wide dependency.

### Coverage Principle

**Security-related and business-critical logic must have test coverage.** Not every file needs a test — focus on code where bugs cause data loss, fund loss, or incorrect behavior.

### Test Priority Matrix

| Priority | Module | Why | Test Type |
|----------|--------|-----|-----------|
| **P0 — Must** | `crypto-utils.ts` (encrypt/decrypt) | Wrong crypto = lost funds | Unit: round-trip, edge cases, wrong password |
| **P0 — Must** | `keychain-signer.ts` (derive + sign) | Wrong signature = failed/lost tx | Unit: known BIP-39 test vectors, deterministic output |
| **P0 — Must** | `error-codes.ts` (exit code mapping) | Agents rely on exit codes for retry logic | Unit: every prefix maps correctly |
| **P0 — Must** | `output-formatter.ts` (3 modes) | CLI's core contract with consumers | Unit: each mode produces expected format |
| **P0 — Must** | `logger.ts` (sanitize) | Leaking keys in logs = security breach | Unit: regex catches private keys and mnemonics |
| **P1 — Should** | `transfer` command | Core business flow | Integration: mock API, verify sign+broadcast sequence |
| **P1 — Should** | `swap` command | Complex multi-step flow | Integration: mock SSE quote + allowance + build-tx |
| **P1 — Should** | `staking` command | Business flow | Integration: mock protocol list + stake tx |
| **P1 — Should** | `config-manager.ts` | Priority override logic is subtle | Unit: file < env var < CLI override |
| **P1 — Should** | `confirm-transaction.ts` | Must skip in agent mode, honor --yes | Unit: mode-based behavior |
| **P2 — Nice** | `balance` command | Read-only, lower risk | Integration: mock API response |
| **P2 — Nice** | `mode-detector.ts` | Simple logic | Unit: TTY detection |
| **P2 — Nice** | Zod schemas | Input validation | Unit: valid/invalid inputs |

### Test Infrastructure

- Mock factory for OneKey API responses (reusable across command tests)
- Mock Keychain storage (in-memory `Map` implementing `SecureStorage` interface)
- Known BIP-39 test mnemonic for deterministic derivation tests
- Jest config in `packages/cli/jest.config.ts`, extending root config

---

## 11. Non-Goals

- **No GUI** — terminal tool only
- **No daemon/server mode** — every invocation is a single command
- **No database** — Keychain for secrets, API for data
- **No multi-chain in MVP** — EVM only, architecture ready for more
- **No multi-wallet in MVP** — single `default` wallet, key format ready for more
- **No hardware wallet** — future phase
- **No Linux/Windows Keychain** — macOS only in MVP, `SecureStorage` interface ready
- **No system proxy auto-detection** — read `https_proxy` env var only
- **No approval management** — not in MVP scope (was in v1 spec)
- **No market/token info commands** — not in MVP scope (was in v1 spec)
