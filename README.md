# BNBPartyFactory

[![Build and Test](https://github.com/bnb-party/BNBParty.Factory/actions/workflows/node.js.yml/badge.svg)](https://github.com/bnb-party/BNBParty.Factory/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/bnb-party/BNBParty.Factory/branch/master/graph/badge.svg)](https://codecov.io/gh/bnb-party/BNBParty.Factory)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/bnb-party/BNBParty.Factory/blob/readme/LICENSE)

**BNBPartyFactory** is your gateway to hosting liquidity parties and creating **custom ERC20** tokens on the **Binance Smart Chain (BSC)**. Leveraging Uniswap V3, it lets you kick off liquidity pools, orchestrate token swaps, and manage your liquidity with flair. Integrates seamlessly with **Uniswap V3's non-fungible position manager** and **swap router** for top-notch trading and liquidity management.

### Navigation

-   [Installation](#installation)
-   [Create Party](#create-party)
-   [Join Party](#join-liquidity-party)
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

## Create Party

Welcome to the exciting world of liquidity and token creation! With the `Create Party`, you can effortlessly launch your very own liquidity party, complete with a fresh new token and an initial liquidity pool. Here’s how it works:

**What You’ll Do:**

1. **Create Your Token:** Define the name and symbol of your new ERC20 token. Whether you’re creating a new asset for fun or business, this step sets the foundation for your liquidity party.
2. **Set Up Your Liquidity Pool:** Instantly establish a liquidity pool where your new token will thrive. This is where the magic happens—creating a space for trading and liquidity.
3. **Get the Party Started:** Upon creation, the liquidity pool is linked to you, the party’s host, ensuring you’re recognized as the pioneer. If you contribute more than the required token creation fee, you get an extra boost by executing a swap.

**Key Benefits:**

-   **Effortless Setup:** Streamline your token creation and liquidity pool setup with a single function call.
-   **Immediate Impact:** Start engaging with your new token right away, making a splash in the liquidity space.
-   **Stay in Control:** Manage the entire process smoothly and efficiently, from token creation to liquidity provision.

**How to Use:**

```solidity
    function createParty(
        string calldata name,
        string calldata symbol
    ) external payable returns (IERC20 newToken);
```

Simply call the `createParty` function with the desired token **name** and **symbol**, provide the required BNB fee, and watch as your new token and liquidity pool come to life. Whether you’re aiming to create a new asset for your project or just want to explore the liquidity landscape, this function makes it all possible.

So, why wait? Start your liquidity party today and take the first step towards exciting new financial opportunities!

## Join Liquidity Party

Ready to dive into the action? You can effortlessly become part of the excitement by swapping your BNB for the party’s token.

**What You’ll Do:**

1. **Select Your Token:** Pick the token you want to acquire from the liquidity pool. This is the asset you’ll be joining the party with.
2. **Swap Your BNB:** Contribute BNB to the party and exchange it for the desired token. Set the minimum amount you expect to receive to ensure you get a fair deal.
3. **Enjoy the Benefits:** By joining the party, you become an active participant in the liquidity pool, gaining access to the potential rewards and opportunities it offers.

**Key Benefits:**

-   **Smooth Integration:** Effortlessly swap your BNB for the party token with just a few clicks.
-   **Immediate Participation:** Jump straight into the liquidity pool and start benefiting from the party’s activities.
    **How to Get Started:**

```solidity
function joinParty(
        address tokenOut,
        uint256 amountOutMinimum
    ) external payable;
```

Simply provide the token you wish to acquire and the minimum amount you’re willing to accept. Transfer your BNB, and watch as your new token arrives. It’s a straightforward and efficient way to get involved in the liquidity pool and seize new opportunities.

So, get in the groove and join the liquidity party today. With just a few simple steps, you’re part of something big!

## Leave Party

```solidity
function leaveParty(
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external;
```

## License

**BNB-Party** Contracts is released under the [MIT License](https://github.com/bnb-party/BNBParty.Factory/blob/readme/LICENSE).
