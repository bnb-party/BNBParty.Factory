// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyLiquidityHelper.sol";

/// @title BNBPartyLiquidity
/// @notice This abstract contract manages the creation and handling of liquidity pools within the BNB Party system.
abstract contract BNBPartyLiquidity is BNBPartyLiquidityHelper {
    using SafeERC20 for IERC20;

    /// @notice Handles liquidity by decreasing the liquidity, collecting tokens, and creating a new liquidity pool.
    /// @param recipient Address receiving the bonus BNB
    /// @dev Decreases liquidity, collects tokens, creates a new pool, and sends bonuses
    function _handleLiquidity(address recipient) internal {
        IUniswapV3Pool pool = IUniswapV3Pool(msg.sender);
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        address token0 = pool.token0();
        address token1 = pool.token1();
        uint128 liquidity = pool.liquidity();
        uint256 unwrapAmount = party.bonusTargetReach + party.bonusPartyCreator + party.targetReachFee;
        uint160 newSqrtPriceX96;

        // Decrease liquidity and collect tokens
        (uint256 amount0, uint256 amount1) = _decreaseAndCollect(lpToTokenId[msg.sender], liquidity);

        // Approve tokens for the new liquidity pool creation
        IERC20(token0).safeIncreaseAllowance(address(positionManager), amount0);
        IERC20(token1).safeIncreaseAllowance(address(positionManager), amount1);
        
        if (token0 == address(WBNB)) {
            amount0 -= unwrapAmount; // Deduct unwrap amount from token0 if it is WBNB
            isTokenOnPartyLP[token1] = false;
            newSqrtPriceX96 = sqrtPriceCalculator.getNextSqrtPriceFromAmount0RoundingUp(
                sqrtPriceX96,
                liquidity,
                unwrapAmount,
                false
            );
        _createLPAndBurnMemeToken(token0, token1, amount0, amount1, newSqrtPriceX96, party.lpTicksPos1);
        } else {
            amount1 -= unwrapAmount; // Deduct unwrap amount from token1 if it is WBNB
            isTokenOnPartyLP[token0] = false;
            newSqrtPriceX96 = sqrtPriceCalculator.getNextSqrtPriceFromAmount1RoundingDown(
                sqrtPriceX96,
                liquidity,
                unwrapAmount / 2,
                false
            );
            _createLPAndBurnMemeToken(token0, token1, amount0, amount1, newSqrtPriceX96, party.lpTicksPos0);
        }

        // Send bonuses
        _unwrapAndSendBNB(recipient, unwrapAmount);
    }

    function _createLPAndBurnMemeToken(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        uint160 sqrtPriceX96,
        Ticks memory ticks
    ) internal {
        // Create new Liquidity Pool
        _createLP(positionManager, token0, token1, amount0, amount1, sqrtPriceX96, party.lpFee, ticks);

        // burn meme tokens
        _burnMemeToken(token0);
    }
}
