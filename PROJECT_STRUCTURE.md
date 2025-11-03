# DDC Market SDK - Project Structure

```
DDC-Market-SDK/
├── src/                     # Source code
│   ├── ddcnft/             # DDCNFT Management API
│   │   ├── DDCNFTManager.ts
│   │   └── index.ts
│   │
│   ├── membership/          # Membership Management API
│   │   ├── MembershipManager.ts
│   │   └── index.ts
│   │
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts
│   │
│   ├── utils/              # Utility functions
│   │   ├── contract.ts
│   │   └── index.ts
│   │
│   └── index.ts            # Main SDK entry point
│
├── dist/                   # Build output (generated)
│   ├── esm/               # ES Module build
│   │   ├── ddcnft/
│   │   ├── membership/
│   │   ├── types/
│   │   ├── utils/
│   │   └── index.js
│   │
│   └── cjs/               # CommonJS build
│       ├── ddcnft/
│       ├── membership/
│       ├── types/
│       ├── utils/
│       ├── index.js
│       └── package.json   # Marks as CommonJS
│
├── examples/              # Usage examples
│   └── basic-usage.ts
│
├── .eslintrc.json         # ESLint configuration
├── .gitignore            # Git ignore rules
├── .npmignore            # NPM ignore rules
├── .prettierrc           # Prettier configuration
├── LICENSE               # MIT License
├── package.json          # Package metadata and dependencies
├── README.md             # Main documentation
├── ARCHITECHTURE.md      # Architecture diagram
├── USAGE.md              # Usage guide
├── tsconfig.json         # Base TypeScript config
├── tsconfig.esm.json     # ESM TypeScript config
└── tsconfig.cjs.json     # CJS TypeScript config
```

## Key Files & Directories

### Source Code (`src/`)

#### `src/ddcnft/DDCNFTManager.ts`

- DDCNFT Management API implementation
- Methods: deployDDCNFT, mint, transfer, setBaseURI, getTokenURI
- Handles NFT contract deployment and operations

#### `src/membership/MembershipManager.ts`

- Membership Management API implementation
- Methods: deployMembership, setMembershipTier, purchaseMembership, verifyMembership
- Handles membership contract deployment and operations

#### `src/types/index.ts`

- TypeScript type definitions for the SDK
- Includes: DDCMarketConfig, DeploymentResult
- Custom SDKError class

#### `src/utils/contract.ts`

- Utility functions for contract operations
- Address validation
- Contract instance creation helpers

#### `src/index.ts`

- Main SDK entry point
- Exports all public APIs and types

### Configuration Files

#### `package.json`

- Package name: `@ddc-market/sdk`
- Supports dual module formats (ESM + CJS)
- Dependencies: ethers v6
- Scripts: build, clean, dev, prepublishOnly

#### TypeScript Configurations

- `tsconfig.json`: Base configuration
- `tsconfig.esm.json`: ESM-specific config (moduleResolution: bundler)
- `tsconfig.cjs.json`: CJS-specific config (moduleResolution: node)

#### Build Output

- ESM: `dist/esm/` - Modern ES modules
- CJS: `dist/cjs/` - CommonJS for Node.js compatibility
- Both include TypeScript declaration files (`.d.ts`)

## Build Process

1. **ESM Build**: `tsc -p tsconfig.esm.json` → `dist/esm/`
2. **CJS Build**: `tsc -p tsconfig.cjs.json` → `dist/cjs/`
3. **Post-build**: Creates `dist/cjs/package.json` to mark as CommonJS

## Module Resolution

The package supports both import styles:

```typescript
// ESM
import { DDCNFTManager } from '@ddc-market/sdk';

// CJS
const { DDCNFTManager } = require('@ddc-market/sdk');
```

This is achieved through the `exports` field in `package.json`:

```json
{
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js"
    }
  }
}
```

## Next Steps

1. **Add Contract ABIs**: Create `src/abis/` directory with contract ABIs
2. **Implement Contract Methods**: Replace placeholder code with actual implementations
3. **Add Tests**: Create `test/` directory with unit and integration tests
4. **CI/CD**: Enhance GitHub Actions workflows
5. **Documentation**: Add API reference documentation
