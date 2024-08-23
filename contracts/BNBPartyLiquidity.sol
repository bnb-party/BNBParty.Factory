// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyCreation.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title BNBPartyLiquidity
/// @notice This abstract contract manages handling of liquidity pools within the BNB Party system.
abstract contract BNBPartyLiquidity is BNBPartyCreation {
    /// @notice Handles liquidity by decreasing the liquidity, collecting tokens, and creating a new liquidity pool.
    /// @param recipient Address receiving the bonus BNB
    /// @dev Decreases liquidity, collects tokens, creates a new pool, and sends bonuses
    function _handleLiquidity(address recipient) internal {
        IUniswapV3Pool pool = IUniswapV3Pool(msg.sender);
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        address token0 = pool.token0();
        address token1 = pool.token1();
        uint128 liquidity = pool.liquidity();

        // Decrease liquidity and collect tokens
        (uint256 amount0, uint256 amount1) = BNBPositionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: lpToTokenId[msg.sender],
                liquidity: liquidity,
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

        uint256 unwrapAmount = party.bonusTargetReach + party.bonusPartyCreator + party.targetReachFee;
        uint160 newSqrtPriceX96;
        if (token0 == address(WBNB)) {
            amount0 -= unwrapAmount; // Deduct unwrap amount from token0 if it is WBNB
            isTokenOnPartyLP[token1] = false;
            newSqrtPriceX96 = sqrtPriceCalculator.getNextSqrtPriceFromAmount0RoundingUp(
                sqrtPriceX96,
                liquidity,
                unwrapAmount,
                false
            );
        } else {
            amount1 -= unwrapAmount; // Deduct unwrap amount from token1 if it is WBNB
            isTokenOnPartyLP[token0] = false;
            newSqrtPriceX96 = sqrtPriceCalculator.getNextSqrtPriceFromAmount1RoundingDown(
                sqrtPriceX96,
                liquidity,
                unwrapAmount / 2,
                false
            );
        }

        IERC20(token0).approve(address(positionManager), amount0);
        IERC20(token1).approve(address(positionManager), amount1);
        // Create new Liquidity Pool
        _createLP(positionManager, token0, token1, amount0, amount1, newSqrtPriceX96, party.lpFee, party.lpTicks);

        // Send bonuses
        _unwrapAndSendBNB(recipient, unwrapAmount);
        // burn meme tokens
        if(token0 == address(WBNB)) {
            _burnMemeToken(token1);
        }
        else {
            _burnMemeToken(token0);
        }
    }

    function _burnMemeToken(address token) internal {
        uint256 balance = IERC20(token).balanceOf(address(this));
        ERC20Burnable(token).burn(balance);
    }
}
