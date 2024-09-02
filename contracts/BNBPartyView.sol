// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyFee.sol";

/// @title BNBPartyView
/// @notice This abstract contract provides view functions for the BNB Party system, including fee calculations and token checks.
abstract contract BNBPartyView is BNBPartyFee {
    /// @notice Checks if WBNB is the token0 in the provided Uniswap V3 pool
    /// @param liquidityPool Address of the Uniswap V3 pool to check
    /// @return True if WBNB is token0, false otherwise
    /// @dev Reverts if the provided pool address is zero
    function isToken0WBNB(
        IUniswapV3Pool liquidityPool
    ) external view returns (bool) {
        if (liquidityPool == IUniswapV3Pool(address(0))) {
            revert ZeroAddress();
        }
        return liquidityPool.token0() == address(WBNB); // Checks if WBNB is token0
    }

    /// @notice Calculates the fees earned based on liquidity and global fee growth
    /// @param liquidity Amount of liquidity in the pool
    /// @param feeGrowthGlobalX128 Global fee growth value
    /// @return feesEarned Calculated fees earned
    /// @dev Uses fixed-point math to compute fees
    function calculateFees(
        uint256 liquidity,
        uint256 feeGrowthGlobalX128
    ) public pure returns (uint256 feesEarned) {
        feesEarned = (feeGrowthGlobalX128 * liquidity) / FEE_GROWTH_GLOBAL_SCALE;
    }

    /// @notice Retrieves the fee growth inside the position from the last observation
    /// @param pool Address of the Uniswap V3 pool
    /// @return feeGrowthInside0LastX128 Fee growth inside for token0 from the last observation
    /// @return feeGrowthInside1LastX128 Fee growth inside for token1 from the last observation
    /// @dev Returns (0, 0) if the pool address is zero
    function getFeeGrowthInsideLastX128(
        IUniswapV3Pool pool,
        INonfungiblePositionManager manager
    )
        external
        view
        returns (
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128
        )
    {
        if (pool == IUniswapV3Pool(address(0)) || address(manager) == address(0)) {
            return (0, 0);
        }
        (
            feeGrowthInside0LastX128,
            feeGrowthInside1LastX128
        ) = manager == BNBPositionManager ? _getPartyFeeGrowthInsideLastX128(pool) : _getFeeGrowthInsideLastX128(pool);
    }
}
