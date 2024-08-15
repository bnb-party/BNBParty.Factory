// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartySwaps.sol";

/// @title BNBPartyLiquidity
/// @notice This abstract contract manages the creation and handling of liquidity pools within the BNB Party system.
abstract contract BNBPartyLiquidity is BNBPartySwaps {
    /// @notice Creates the first liquidity pool (FLP) for a given token.
    /// @param _token Address of the token to be used in the liquidity pool
    /// @return liquidityPool Address of the newly created liquidity pool
    /// @dev Sets the token amounts based on the balance and initializes the pool
    function _createFLP(address _token) internal returns (address liquidityPool) {
        (address tokenA, address tokenB, uint160 sqrtPrice) = _getTokenPairAndPrice(_token);
        uint256 amount0;
        uint256 amount1;
        if (IERC20(tokenA).balanceOf(address(this)) == party.initialTokenAmount) {
            amount0 = party.initialTokenAmount; // Set amount0 if tokenA balance matches the initial amount
        } else {
            amount1 = party.initialTokenAmount; // Otherwise, set amount1
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
        isParty[liquidityPool] = true; // Mark the liquidity pool as a party pool
        isTokenOnPartyLP[_token] = true; // Mark the token as part of the party LP
    }

    /// @notice Creates a new liquidity pool and mints liquidity positions.
    /// @param liquidityManager Address of the liquidity manager contract
    /// @param token0 Address of the first token in the pool
    /// @param token1 Address of the second token in the pool
    /// @param amount0 Amount of token0 to add to the pool
    /// @param amount1 Amount of token1 to add to the pool
    /// @param sqrtPriceX96 The initial sqrt price of the pool
    /// @param fee Fee tier for the pool
    /// @return liquidityPool Address of the created liquidity pool
    /// @dev Creates and initializes the pool, then mints liquidity for the position
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

    /// @notice Handles liquidity by decreasing the liquidity, collecting tokens, and creating a new liquidity pool.
    /// @param recipient Address receiving the bonus BNB
    /// @dev Decreases liquidity, collects tokens, creates a new pool, and sends bonuses
    function _handleLiquidity(address recipient) internal {
        IUniswapV3Pool pool = IUniswapV3Pool(msg.sender);
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

        uint256 unwrapAmount = party.bonusTargetReach + party.bonusPartyCreator + party.targetReachFee;
        if (token0 == address(WBNB)) {
            amount0 -= unwrapAmount; // Deduct unwrap amount from token0 if it is WBNB
            isTokenOnPartyLP[token1] = false;
        } else {
            amount1 -= unwrapAmount; // Deduct unwrap amount from token1 if it is WBNB
            isTokenOnPartyLP[token0] = false;
        }

        IERC20(token0).approve(address(positionManager), amount0);
        IERC20(token1).approve(address(positionManager), amount1);
        uint160 sqrtPriceX96 = _calcSqrtPriceX96(amount0, amount1);
        // Create new Liquidity Pool
        _createLP(positionManager, token0, token1, amount0, amount1, sqrtPriceX96, party.lpFee);

        // Send bonuses
        _unwrapAndSendBNB(recipient, unwrapAmount);
    }

    function _calcSqrtPriceX96(
        uint256 amount0,
        uint256 amount1
    ) internal pure returns (uint160 sqrtPriceX96) {
        uint256 ratioX192 = (amount1 << 192) / amount0; // Shift left by 192 to maintain precision
        sqrtPriceX96 = uint160(_sqrt(ratioX192));
    }

    function _sqrt(uint256 x) private pure returns (uint256 y) {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
