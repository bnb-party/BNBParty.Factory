// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyCreation.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title BNBPartyLiquidityHelper
/// @notice This abstract contract provides helper functions for managing liquidity within the BNB Party system
/// @dev Inherits from BNBPartyCreation and uses Uniswap's INonfungiblePositionManager for liquidity management
abstract contract BNBPartyLiquidityHelper is BNBPartyCreation {
    /// @notice Decreases liquidity from a position and collects the resulting tokens
    /// @param tokenId The ID of the liquidity position to decrease
    /// @param liquidity The amount of liquidity to decrease
    /// @return amount0 The amount of token0 collected
    /// @return amount1 The amount of token1 collected
    function _decreaseAndCollect(
        uint256 tokenId,
        uint128 liquidity
    ) internal returns (uint256 amount0, uint256 amount1) {
        // Decrease liquidity from the position and receive the amount of token0 and token1
        (amount0, amount1) = BNBPositionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: 0, // Minimum amount of token0 to collect, set to 0 for flexibility
                amount1Min: 0, // Minimum amount of token1 to collect, set to 0 for flexibility
                deadline: block.timestamp // Deadline for the transaction to be completed
            })
        );

        // Collect the tokens from the position after liquidity decrease
        BNBPositionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this), // Collect tokens to this contract address
                amount0Max: uint128(amount0), // Maximum amount of token0 to collect
                amount1Max: uint128(amount1) // Maximum amount of token1 to collect
            })
        );
    }

    /// @notice Approves tokens for the position manager to spend
    /// @param token0 The address of the first token
    /// @param token1 The address of the second token
    /// @param amount0 The amount of token0 to approve
    /// @param amount1 The amount of token1 to approve
    function _approveTokens(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1
    ) internal {
        IERC20(token0).approve(address(positionManager), amount0);
        IERC20(token1).approve(address(positionManager), amount1);
    }

    /// @notice Burns all MEME tokens held by this contract
    /// @param token The address of the MEME token to burn
    function _burnMemeToken(address token) internal {
        uint256 balance = IERC20(token).balanceOf(address(this));
        ERC20Burnable(token).burn(balance);
    }
}
