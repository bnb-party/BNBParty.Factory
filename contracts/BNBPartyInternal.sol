// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./BNBPartyState.sol";
abstract contract BNBPartyInternal is BNBPartyState {
    function _createFLP(
        address _token
    ) internal returns (address liquidityPool) {
        // tokenA < tokenB
        (address tokenA, address tokenB) = _token < address(WBNB)
            ? (_token, address(WBNB))
            : (address(WBNB), _token);
        uint256 amount0;
        uint256 amount1;
        if (IERC20(tokenA).balanceOf(address(this)) == initialTokenAmount) {
            amount0 = initialTokenAmount;
        } else {
            amount1 = initialTokenAmount;
        }

        IERC20(_token).approve(address(BNBPositionManager), initialTokenAmount);
        liquidityPool = _createLP(
            BNBPositionManager,
            tokenA,
            tokenB,
            amount0,
            amount1,
            partyLPFee
        );
        isParty[liquidityPool] = true;
    }

    function _createLP(
        INonfungiblePositionManager liquidityManager,
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        uint24 fee
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
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
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
                    tokenId: lpToTokenId[msg.sender],
                    liquidity: pool.liquidity(),
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                })
            );
        address token0 = pool.token0();
        address token1 = pool.token1();
        // approve new LP
        IERC20(token0).approve(address(positionManager), amount0);
        IERC20(token1).approve(address(positionManager), amount1);
        // create new Liquidity Pool
        //_createLP(positionManager, token0, token1, amount0, amount1, lpFee);
    }
}
