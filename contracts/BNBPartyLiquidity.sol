// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyLiquidityHelper.sol";

/// @title BNBPartyLiquidity
/// @notice This abstract contract manages the creation and handling of liquidity pools within the BNB Party system.
abstract contract BNBPartyLiquidity is BNBPartyLiquidityHelper {
    using SafeERC20 for IERC20;

    /// @notice Handles liquidity by decreasing liquidity, collecting tokens, and creating a new liquidity pool.
    /// @param recipient Address receiving the bonus BNB
    /// @dev Decreases liquidity, collects tokens, creates a new pool, and sends bonuses
    function _handleLiquidity(address recipient) internal returns (address liquidityPool, uint256 tokenId) {
        IUniswapV3Pool pool = IUniswapV3Pool(msg.sender);
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        uint128 liquidity = pool.liquidity();
        uint256 unwrapAmount = party.bonusTargetReach + party.bonusPartyCreator + party.targetReachFee;

        (address token0, address token1, address memeToken) = _getTokens(pool);
        
        (uint256 memeAmount, uint256 wbnbAmount, uint160 newSqrtPriceX96) = _decreaseLiquidityAndCollect(
            liquidity, sqrtPriceX96, unwrapAmount, token0
        );

        wbnbAmount -= unwrapAmount;
        isTokenOnPartyLP[memeToken] = false;

        // Approve tokens for the new liquidity pool creation
        _approveTokensForLP(wbnbAmount, memeAmount, memeToken);

        // Create new Liquidity Pool
        (liquidityPool, tokenId) = _createLP(
            positionManager,
            token0,
            token1,
            _isToken0WBNB(token0) ? wbnbAmount : memeAmount,
            _isToken0WBNB(token0) ? memeAmount : wbnbAmount,
            newSqrtPriceX96,
            party.lpFee,
            _getTicks(token0, party.lpTicks)
        );

        // Send bonuses and burn meme tokens
        _unwrapAndSendBNB(recipient, unwrapAmount);
        _burnMemeToken(memeToken);
    }

    function _getTokens(IUniswapV3Pool pool) internal view returns (address token0, address token1, address memeToken) {
        token0 = pool.token0();
        token1 = pool.token1();
        memeToken = _isToken0WBNB(token0) ? token1 : token0;
    }

    function _decreaseLiquidityAndCollect(
        uint128 liquidity,
        uint160 sqrtPriceX96,
        uint256 unwrapAmount,
        address token0
    )
        internal
        returns (uint256 memeAmount, uint256 wbnbAmount, uint160 newSqrtPriceX96)
    {
        if (_isToken0WBNB(token0)) {
            (wbnbAmount, memeAmount) = _decreaseAndCollect(lpToTokenId[msg.sender], liquidity);
            newSqrtPriceX96 = sqrtPriceCalculator.getNextSqrtPriceFromAmount0RoundingUp(
                sqrtPriceX96, liquidity, unwrapAmount, false
            );
        } else {
            (memeAmount, wbnbAmount) = _decreaseAndCollect(lpToTokenId[msg.sender], liquidity);
            newSqrtPriceX96 = sqrtPriceCalculator.getNextSqrtPriceFromAmount1RoundingDown(
                sqrtPriceX96, liquidity, unwrapAmount, false
            );
        }
    }

    function _approveTokensForLP(uint256 wbnbAmount, uint256 memeAmount, address memeToken) internal {
        IERC20(address(WBNB)).safeIncreaseAllowance(address(positionManager), wbnbAmount);
        IERC20(memeToken).safeIncreaseAllowance(address(positionManager), memeAmount);
    }
}
