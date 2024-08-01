// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IBNBPartyFactory
/// @notice Interface for the BNB Party Factory contract, which handles token creation, liquidity pool management, and party operations.
interface IBNBPartyFactory {
    /// @notice Creates a new ERC20 token and initializes the liquidity pool (FLP).
    /// @param name The name of the token.
    /// @param symbol The symbol of the token.
    /// @return newToken The address of the newly created token.
    function createParty(
        string calldata name,
        string calldata symbol
    ) external payable returns (IERC20 newToken);

    /// @notice Handles swapping operations for the First Liquidity Pool (FLP).
    /// @param recipient The address that will receive the swapped tokens or liquidity.
    function handleSwap(address recipient) external;

    /// @notice Struct containing parameters for party configuration.
    struct Party {
        uint256 partyTarget; // The target amount of BNB for the party.
        uint256 createTokenFee; // The fee required to create a new token.
        uint24 partyLpFee; // The fee for the party's liquidity pool.
        uint24 lpFee; // The fee for the liquidity pool.
        uint256 initialTokenAmount; // The initial amount of tokens to be minted.
        uint160 sqrtPriceX96; // The initial price of the liquidity pool in sqrt price format.
        uint256 bonusTargetReach; // Bonus amount given if the party target is reached.
        uint256 bonusPartyCreator; // Bonus amount for the party creator.
        uint256 targetReachFee; // Fee charged upon reaching the target.
        int24 tickLower; // Lower bound of the tick range for the liquidity pool.
        int24 tickUpper; // Upper bound of the tick range for the liquidity pool.
    }

    /// @notice Event emitted when a new party is started.
    /// @param tokenAddress The address of the newly created ERC20 token.
    /// @param owner The address of the party owner.
    /// @param FLPAddress The address of the newly created liquidity pool.
    event StartParty(
        address indexed tokenAddress,
        address indexed owner,
        address indexed FLPAddress
    );

    /// @notice Event emitted when BNB is transferred out.
    /// @param to The address receiving the BNB.
    /// @param amount The amount of BNB transferred.
    event TransferOutBNB(address indexed to, uint256 amount);

    error InsufficientBNB(); // Error thrown when there is insufficient BNB provided.
    error ZeroAddress(); // Error thrown when a zero address is provided.
    error ZeroAmount(); // Error thrown when a zero amount is provided.
    error BonusGreaterThanTarget(); // Error thrown when the bonus amount exceeds the party target.
    error PositionManagerNotSet(); // Error thrown when the position manager is not set.
    error PositionManagerAlreadySet(); // Error thrown when the position manager is already set.
    error SwapRouterAlreadySet(); // Error thrown when the swap router is already set.
    error LPNotAtParty(); // Error thrown when the liquidity pool is not part of the party.
    error ZeroLength(); // Error thrown when an array is empty.
    error BonusAmountTransferFailed(); // Error thrown when transferring bonus amounts fails.
}
