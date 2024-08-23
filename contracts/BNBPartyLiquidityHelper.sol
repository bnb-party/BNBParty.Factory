// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyCreation.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title BNBPartyLiquidityHelper
/// @notice This abstract contract manages the liquidity helper functions within the BNB Party system.
abstract contract BNBPartyLiquidityHelper is BNBPartyCreation {
    function _decreaseAndCollect(
        uint256 tokenId,
        uint128 liquidity
    ) internal returns (uint256 amount0, uint256 amount1) {
        (amount0, amount1) = BNBPositionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );

        BNBPositionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: uint128(amount0),
                amount1Max: uint128(amount1)
            })
        );
    }

    function _approveTokens(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1
    ) internal {
        IERC20(token0).approve(address(positionManager), amount0);
        IERC20(token1).approve(address(positionManager), amount1);
    }

    function _burnMemeToken(address token) internal {
        uint256 balance = IERC20(token).balanceOf(address(this));
        ERC20Burnable(token).burn(balance);
    }
}
