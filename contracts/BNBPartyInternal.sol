// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./BNBPartyModifiers.sol";

abstract contract BNBPartyInternal is BNBPartyModifiers {
    function _createFLP(
        address _token
    ) internal returns (address liquidityPool) {
        (address tokenA, address tokenB, uint160 sqrtPrice) = _getTokenPairAndPrice(_token);
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
            sqrtPrice,
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
        uint160 sqrtPriceX96,
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

    function _unwrapAndSendBNB(address recipient, uint256 unwrapAmount) internal {
        address creator = lpToCreator[msg.sender];
        WBNB.withdraw(unwrapAmount);
        if (recipient == creator) {
            _transferBNB(recipient, party.bonusTargetReach + party.bonusPartyCreator);
        } else {
            _transferBNB(recipient, party.bonusTargetReach);
            _transferBNB(creator, party.bonusPartyCreator);
        }
    }

    function _transferBNB(address recipient, uint256 amount) private {
        // Use call to send BNB
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert BonusAmountTransferFailed();
        }
        emit TransferOutBNB(recipient, amount);
    }

    function _handleLiquidity(address recipient) internal {
        IUniswapV3Pool pool = IUniswapV3Pool(msg.sender);
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        address token0 = pool.token0();
        address token1 = pool.token1();

        // Decrease liquidity and collect tokens
        (uint256 amount0, uint256 amount1) = BNBPositionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: lpToTokenId[msg.sender],
                liquidity: pool.liquidity(),
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );

        BNBPositionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: lpToTokenId[msg.sender],
                recipient: address(this),
                amount0Max: uint128(amount0),
                amount1Max: uint128(amount1)
            })
        );

        uint256 bonusAmount = party.bonusTargetReach + party.bonusPartyCreator + party.targetReachFee;
        if (token0 == address(WBNB)) {
            amount0 -= bonusAmount;
        } else {
            amount1 -= bonusAmount;
        }

        IERC20(token0).approve(address(positionManager), amount0);
        IERC20(token1).approve(address(positionManager), amount1);

        // Create new Liquidity Pool
        _createLP(positionManager, token0, token1, amount0, amount1, sqrtPriceX96, party.lpFee);

        // Send bonuses
        _unwrapAndSendBNB(recipient, bonusAmount);
    }

    function _executeSwap(address tokenOut) internal {
        uint256 amountIn = msg.value - party.createTokenFee;
        _executeSwap(address(WBNB), tokenOut, msg.sender, 0, amountIn);
    }

    function _executeSwap(
        address tokenIn,
        address tokenOut,
        address recipient,
        uint256 amountOutMinimum,
        uint256 amountIn
    ) internal notZeroAddress(address(swapRouter)) {
        ISwapRouter.ExactInputParams memory params = ISwapRouter
            .ExactInputParams({
                path: abi.encodePacked(tokenIn, party.partyLpFee, tokenOut),
                recipient: recipient,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum
            });
        uint256 value = msg.value > 0 ? amountIn : 0;
        swapRouter.exactInput{value: value}(params);
    }

    function _getTokenPairAndPrice(
        address _token
    ) internal view returns (address, address, uint160) {
        if (_token < address(WBNB)) {
            return (_token, address(WBNB), party.sqrtPriceX96);
        }
        else {
            return (address(WBNB), _token, _reverseSqrtPrice(party.sqrtPriceX96));
        }
    }

    function _reverseSqrtPrice(uint160 sqrtPriceX96) internal pure returns (uint160 reverseSqrtPriceX96) {
        reverseSqrtPriceX96 = uint160((1 << 192) / sqrtPriceX96);
    }
}
