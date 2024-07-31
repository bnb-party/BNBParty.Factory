# BNBPartyFactory

[![Build and Test](https://github.com/bnb-party/BNBParty.Factory/actions/workflows/node.js.yml/badge.svg)](https://github.com/bnb-party/BNBParty.Factory/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/bnb-party/BNBParty.Factory/branch/master/graph/badge.svg)](https://codecov.io/gh/bnb-party/BNBParty.Factory)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/bnb-party/BNBParty.Factory/blob/readme/LICENSE)

**The BNBPartyFactory** contract is a smart contract designed for creating and managing liquidity pools and tokens on the **Binance Smart Chain (BSC)** network using **Uniswap V3 technology**. It enables users to start liquidity parties, create new **ERC20 tokens**, handle token swaps, and manage liquidity pool. This contract integrates with **Uniswap V3's non-fungible position manager** and **swap router** to facilitate advanced liquidity and trading operations.

### Navigation

-   [Installation](#installation)
-   [License](#license)

## Installation

**Install the packages:**

```console
npm i
```

**Compile contracts:**

```console
npx hardhat compile
```

**Run tests:**

```console
npx hardhat test
```

**Run coverage:**

```console
npx hardhat coverage
```

**Deploy:**

```console
npx truffle dashboard
```

```console
npx hardhat run ./scripts/deploy.ts --network truffleDashboard
```

## License

**BNB-Party** Contracts is released under the [MIT License](https://github.com/bnb-party/BNBParty.Factory/blob/readme/LICENSE).
