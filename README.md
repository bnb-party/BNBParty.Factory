# BNBPartyFactory

[![Build and Test](https://github.com/bnb-party/BNBParty.Factory/actions/workflows/node.js.yml/badge.svg)](https://github.com/bnb-party/BNBParty.Factory/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/bnb-party/BNBParty.Factory/branch/master/graph/badge.svg)](https://codecov.io/gh/bnb-party/BNBParty.Factory)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/bnb-party/BNBParty.Factory/blob/readme/LICENSE)

**BNBPartyFactory** is a smart contract that serves as a **launchpad** for hosting **liquidity parties** and creating **custom ERC20 tokens** on the **Binance Smart Chain (BSC)**. Leveraging **Uniswap V3**, it facilitates the initiation of liquidity pools, orchestration of token swaps, and management of liquidity. It integrates seamlessly with **Uniswap V3's non-fungible position manager** and **swap router** for advanced trading and liquidity management.

### Navigation

-   [Installation](#installation)
-   [Create Party](#create-party)
-   [Join Party](#join-liquidity-party)
-   [Leave Party](#leave-party)
-   [Swap Router](#swap-router)
-   [UML diagram](#uml-diagram)
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

**Run Curve tests:**

```
npx hardhat run ./scripts/curve.ts
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
        string calldata name,  // Name of the new ERC20 token
        string calldata symbol // Symbol of the new ERC20 token
    ) external payable returns (IERC20 newToken);
```

Simply call the `createParty` function with the desired token **name** and **symbol**, provide the required BNB fee, and watch as your new token and liquidity pool come to life. Whether you’re aiming to create a new asset for your project or just want to explore the liquidity landscape, this function makes it all possible.

So, why wait? Start your liquidity party today and take the first step towards exciting new financial opportunities!

> **Note**
> 
> While the contract allows for multiple tokens to be created using a external cover contract, our internal service only supports the creation of one token per transaction. This design choice ensures consistency and simplifies the interaction process when managing tokens in the system.
> So if create multiple parties in a single transaction, they may not be processed in our system.

## Join Liquidity Party

Ready to dive into the action? You can effortlessly become part of the excitement by swapping your BNB for the party’s token.

**What You’ll Do:**

1. **Select Your Token:** Pick the token you want to acquire from the liquidity pool. This is the asset you’ll be joining the party with.
2. **Swap Your BNB:** Contribute BNB to the party and exchange it for the desired token. Set the minimum amount you expect to receive to ensure you get a fair deal.
3. **Enjoy the Benefits:** By joining the party, you become an active participant in the liquidity pool, gaining access to the potential rewards and opportunities it offers.

**Key Benefits:**

-   **Smooth Integration:** Effortlessly swap your BNB for the party token with just a few clicks.
-   **Immediate Participation:** Jump straight into the liquidity pool and start benefiting from the party’s activities.
-   **Early Access Advantage:** The early buyers enjoy a special price. The longer the party lasts, the greater the opportunity to sell tokens at a more favorable price.
    **How to Get Started:**

```solidity
function joinParty(
    address tokenOut,         // Address of the ERC20 token to be received
    uint256 amountOutMinimum  // Minimum amount of ERC20 token to be received
) external payable;
```

Simply provide the token you wish to acquire and the minimum amount you’re willing to accept. Transfer your BNB, and watch as your new token arrives. It’s a straightforward and efficient way to get involved in the liquidity pool and seize new opportunities.

So, get in the groove and join the liquidity party today. With just a few simple steps, you’re part of something big!

## Leave Party

Saying goodbye to the party? 😢 When you’re ready to exit, you can swap your tokens back to BNB and gracefully make your exit. Simply transfer your tokens to the contract, and it’ll handle the swap for you, ensuring you get the best value. While it’s a bit of a farewell, we’ll make sure your BNB is sent directly to your wallet, so you can leave from party.

```solidity
function leaveParty(
    address tokenIn,          // Address of the token the user wants to swap for BNB
    uint256 amountIn,         // Amount of the token to be swapped
    uint256 amountOutMinimum  // Minimum amount of BNB the user expects to receive from the swap
) external;

```

## Swap Router

#### **Token Swaps with Swap Router**

The Swap Router offers an alternative way to exchange tokens without using `joinParty` and `leaveParty` functions. This method often results in lower gas costs.

### BNB -> WBNB -> MEME

Convert BNB to WBNB and then swap to MEME tokens:

```js
const amountIn = ethers.parseUnits("1", 18) // Amount of BNB to swap
const path = ethers.concat([
    ethers.zeroPadValue(await weth9.getAddress(), 20),
    ethers.zeroPadValue(ethers.toBeHex(FeeAmount.HIGH), 3),
    ethers.zeroPadValue(MEME, 20),
]) // Define the swap path

const params = {
    path: path,
    recipient: await signers[0].getAddress(), // Recipient of the final tokens
    deadline: deadline, // Transaction deadline
    amountIn: amountIn, // Amount of BNB being swapped
    amountOutMinimum: "0", // Minimum amount of tokens to receive
}

await BNBSwapRouter.exactInput(params, { value: amountIn }) // Perform the swap
```

**What Happens:**

1. The user specifies the amount of **BNB** to swap **(amountIn)**.
2. The path variable defines the conversion path: **BNB** is first wrapped into **WBNB**, then swapped to **MEME** tokens.
3. The params object contains all necessary parameters for the swap, including the recipient address, deadline, amount of **BNB**, and minimum amount of tokens to receive.
4. The `exactInput` method of the **BNBSwapRouter** contract is called with the specified parameters, performing the swap and sending the MEME tokens to the recipient.

### MEME -> WBNB -> BNB (Multicall)

Swap MEME tokens to WBNB and then unwrap WBNB to BNB using a multicall:

```js
const amountIn = ethers.parseUnits("1", 17) // Amount of MEME to swap
const MEME = position.token0
const path = ethers.concat([
    ethers.zeroPadValue(MEME, 20),
    ethers.zeroPadValue(ethers.toBeHex(FeeAmount.HIGH), 3),
    ethers.zeroPadValue(await weth9.getAddress(), 20),
]) // Define the swap path

const params = {
    path: path,
    recipient: ethers.ZeroAddress, // Temporary recipient for WBNB
    deadline: deadline, // Transaction deadline
    amountIn: amountIn, // Amount of MEME being swapped
    amountOutMinimum: "0", // Minimum amount of tokens to receive
}

const exactInputData = BNBSwapRouter.interface.encodeFunctionData("exactInput", [params])
// Encode the unwrapWETH9 call to convert WETH to ETH
const unwrapWETH9Data = BNBSwapRouter.interface.encodeFunctionData("unwrapWETH9", ["0", await signers[1].getAddress()])

// Approve MEME tokens for the Swap Router
const MEMEContract = new ethers.Contract(MEME, ERC20_ABI, signers[0])
await MEMEContract.approve(BNBSwapRouter.address, amountIn)

// Perform the multicall swap and unwrap
await BNBSwapRouter.multicall([exactInputData, unwrapWETH9Data])
```

**What Happens:**

1. The user specifies the amount of **MEME** tokens to swap **(amountIn)**.
2. The path variable defines the conversion path: **MEME** tokens are first swapped to **WBNB**.
3. The params object contains all necessary parameters for the swap, including the recipient address, deadline, amount of **MEME** tokens, and minimum amount of tokens to receive.
4. The `exactInput` method is encoded to perform the **MEME** to **WBNB** swap.
5. The `unwrapWETH9` method is encoded to unwrap the **WBNB** to **BNB**, sending it to the specified address.
6. Before performing the `multicall`, **MEME** tokens are `approved` for transfer by the **BNBSwapRouter**.
7. The `multicall` method of the **BNBSwapRouter** contract is called with the encoded `exactInput` and `unwrapWETH9` data, performing both operations in a single transaction. This results in swapping **MEME** to **WBNB** and then converting **WBNB** to **BNB**, which is sent to the recipient.

This section demonstrates how to efficiently perform token swaps using the **Swap Router**, providing an alternative to the `joinParty` and `leaveParty` functions while saving on gas costs

## UML Diagram

![classDiagram](https://github.com/user-attachments/assets/8c102041-7e2a-4804-a7d1-fef2acfefdef)

## License

**BNB-Party** Contracts is released under the [MIT License](https://github.com/bnb-party/BNBParty.Factory/blob/readme/LICENSE).
