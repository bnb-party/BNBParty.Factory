// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./BNBPartyState.sol";

abstract contract BNBPartyInternal is BNBPartyState {
    function _createFLP(
        address _token
    ) internal returns (address liquidityPool) {
        uint256 amount1 = IERC20(_token).balanceOf(address(this));
        liquidityPool = _createLP(BNBPositionManager, WBNB, _token, 0, amount1);
        isParty[liquidityPool] = true;
    }

    function _createLP(
        INonfungiblePositionManager liquidityManager,
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1
    ) internal returns (address liquidityPool) {
        // Create LP
        liquidityPool = liquidityManager.createAndInitializePoolIfNecessary(
            token0,
            token1,
            fee,
            sqrtPriceX96
        );

        // Mint LP
        (poolToTokenId[liquidityPool], , , ) = liquidityManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: fee,
                tickLower: -887272,
                tickUpper: 887272,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: amount0,
                amount1Min: amount1,
                recipient: address(this),
                deadline: block.timestamp
            })
        );
    }
}
