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
        if (IERC20(tokenA).balanceOf(address(this)) == party.initialTokenAmount) {
            amount0 = party.initialTokenAmount;
        } else {
            amount1 = party.initialTokenAmount;
        }

        IERC20(_token).approve(
            address(BNBPositionManager),
            party.initialTokenAmount
        );
        liquidityPool = _createLP(
            BNBPositionManager,
            tokenA,
            tokenB,
            amount0,
            amount1,
            party.partyLpFee
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
            party.sqrtPriceX96
        );

        // Mint LP
        (lpToTokenId[liquidityPool], , , ) = liquidityManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: fee,
                tickLower: party.tickLower,
                tickUpper: party.tickUpper,
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
        WBNB.withdraw(party.bonusTargetReach);
        (bool success, ) = recipient.call{value: party.bonusTargetReach}("");
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
        _createLP(positionManager, token0, token1, amount0, amount1, party.lpFee);
    }

    function _executeSwap(address tokenOut) internal {
        require(address(swapRouter) != address(0), "BNBPartyFactory: swapRouter not set");
        uint256 amountIn = msg.value - party.createTokenFee;

        // Prepare swap parameters
        ISwapRouter.ExactInputParams memory params = ISwapRouter
            .ExactInputParams({
                path: abi.encodePacked(
                    address(WBNB),
                    party.partyLpFee,
                    tokenOut
                ),
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: 0
            });

        swapRouter.exactInput{value: amountIn }(params);
    }
}
