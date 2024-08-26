// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartySwaps.sol";

/// @title BNBPartyCreation
/// @notice This abstract contract manages the creation pools within the BNB Party system.
abstract contract BNBPartyCreation is BNBPartySwaps {
    /// @notice Creates the first liquidity pool (FLP) for a given token.
    /// @param _token Address of the token to be used in the liquidity pool
    /// @return liquidityPool Address of the newly created liquidity pool
    /// @dev Sets the token amounts based on the balance and initializes the pool
    function _createFLP(address _token) internal returns (address liquidityPool) {
        (address token0, address token1, uint160 sqrtPrice) = _getTokenPairAndPrice(_token);
        // Determine the token amounts
        (uint256 amount0, uint256 amount1) = _calculateAmounts(token0);
        IERC20(_token).approve(address(BNBPositionManager), party.initialTokenAmount);
        liquidityPool = _createLP(
            BNBPositionManager,
            token0,
            token1,
            amount0,
            amount1,
            sqrtPrice,
            party.partyLpFee,
            party.partyTicks
        );
        isParty[liquidityPool] = true; // Mark the liquidity pool as a party pool
        isTokenOnPartyLP[_token] = true; // Mark the token as part of the party LP
    }

    /// @notice Creates a new liquidity pool and mints liquidity positions.
    /// @param liquidityManager Address of the liquidity manager contract
    /// @param token0 Address of the first token in the pool
    /// @param token1 Address of the second token in the pool
    /// @param amount0 Amount of token0 to add to the pool
    /// @param amount1 Amount of token1 to add to the pool
    /// @param sqrtPriceX96 The initial sqrt price of the pool
    /// @param fee Fee tier for the pool
    /// @return liquidityPool Address of the created liquidity pool
    /// @dev Creates and initializes the pool, then mints liquidity for the position
    function _createLP(
        INonfungiblePositionManager liquidityManager,
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        uint160 sqrtPriceX96,
        uint24 fee,
        Ticks memory ticks
    ) internal returns (address liquidityPool) {
        // Create LP
        liquidityPool = liquidityManager.createAndInitializePoolIfNecessary(
            token0,
            token1,
            fee,
            sqrtPriceX96
        );

        // Mint LP
        (lpToTokenId[liquidityPool], , , ) = liquidityManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: fee,
                tickLower: ticks.tickLower,
                tickUpper: ticks.tickUpper,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );
    }

    /// @notice Calculates the token amounts for the liquidity pool.
    /// @param token0 Address of the first token.
    /// @return amount0 The amount of token0.
    /// @return amount1 The amount of token1.
    function _calculateAmounts(address token0) internal view returns (uint256 amount0, uint256 amount1) {
        if (token0 != address(WBNB)) {
            amount0 = party.initialTokenAmount; // Set amount0 if tokenA is not WBNB
        } else {
            amount1 = party.initialTokenAmount; // Otherwise, set amount1 if tokenA is WBNB
        }
    }
}
