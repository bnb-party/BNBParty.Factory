// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "./interfaces/INonfungiblePositionManager.sol";

contract PoolCreation {
    INonfungiblePositionManager public immutable positionManager;
    uint24 public immutable fee;
    uint160 public immutable sqrtPriceLimitX96;

    function _addInitialLiquidity(IERC20 token, uint256 amount) internal {
        token.approve(address(positionManager), amount);
        positionManager.createAndInitializePoolIfNecessary(
            address(token),
            positionManager.WETH9(),
            fee, // Fee tier
            sqrtPriceLimitX96
        );
        INonfungiblePositionManager.MintParams
            memory params = INonfungiblePositionManager.MintParams({
                token0: address(token),
                token1: positionManager.WETH9(),
                fee: fee, // Fee tier
                tickLower: -887272, // Lower tick
                tickUpper: 887272, // Upper tick
                amount0Desired: amount,
                amount1Desired: 0,
                amount0Min: amount,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            });
        positionManager.mint{value: 0}(params);
    }
}
