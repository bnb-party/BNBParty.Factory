// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./BNBPartyState.sol";

abstract contract BNBPartyInternal is BNBPartyState {
    function _createFLP(
        IERC20 _token
    ) internal returns (address liquidityPool) {
        uint256 amount0 = msg.value;
        if (amount0 > 0) {
            // Wrap WBNB
            WBNB.deposit{value: amount0}();
        }
        uint256 amount1 = _token.balanceOf(address(this));
        liquidityPool = _createLP(
            BNBPositionManager,
            address(_token),
            amount0,
            amount1
        );
        isParty[liquidityPool] = true;
    }

    function _createLP(
        INonfungiblePositionManager liquidityManager,
        address token1,
        uint256 amount0,
        uint256 amount1
    ) internal returns (address liquidityPool) {
        // Create LP
        liquidityPool = liquidityManager.createAndInitializePoolIfNecessary(
            address(WBNB),
            token1,
            fee,
            sqrtPriceX96
        );

        // Mint LP
        (poolToTokenId[liquidityPool], , , ) = liquidityManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: address(WBNB),
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

    function _unwrapAndSendBNB(address recipient) internal {
        WBNB.withdraw(returnAmount);
        (bool success, ) = recipient.call{value: returnAmount}("");
        require(success, "Transfer failed.");
    }

    function _handleLiquidity() internal {
        // deacrease liquidity from old pool
        IUniswapV3Pool pool = IUniswapV3Pool(msg.sender);
        (uint256 amount0, uint256 amount1) = BNBPositionManager
            .decreaseLiquidity(
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: poolToTokenId[msg.sender],
                    liquidity: pool.liquidity(),
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                })
            );
        address token1 = pool.token1();
        // create new Liquidity Pool
        _createLP(positionManager, token1, amount0, amount1);
    }
}
