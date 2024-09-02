// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyModifiers.sol";
import "./interfaces/IUniswapV3Pool.sol";

/// @title BNBPartyFee
/// @notice This abstract contract provides internal functions for calculating fees in the BNB Party system.
abstract contract BNBPartyFee is BNBPartyModifiers {
    /// @notice Internal function to retrieve the fee growth inside the position from the last observation
    /// @param pool Address of the Uniswap V3 pool
    /// @return feeGrowthInside0LastX128 Fee growth inside for token0 from the last observation
    /// @return feeGrowthInside1LastX128 Fee growth inside for token1 from the last observation
    function _getFeeGrowthInsideLastX128(
        IUniswapV3Pool pool
    )
        internal
        view
        returns (
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128
        )
    {
        (
            feeGrowthInside0LastX128,
            feeGrowthInside1LastX128
        ) = _getFeeGrowthInsideLastX128(
            pool,
            keccak256(
                abi.encodePacked(
                    address(positionManager),
                    party.lpTicks.tickLower,
                    party.lpTicks.tickUpper
                )
            )
        );
    }

    /// @notice Internal function to retrieve the fee growth inside the position from the last observation
    /// @param pool Address of the Uniswap V3 pool
    function _getPartyFeeGrowthInsideLastX128(
        IUniswapV3Pool pool
    )
        internal
        view
        returns (
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128
        )
    {
        (
            feeGrowthInside0LastX128,
            feeGrowthInside1LastX128
        ) = _getFeeGrowthInsideLastX128(
            pool,
            keccak256(
                abi.encodePacked(
                    address(BNBPositionManager),
                    party.partyTicks.tickLower,
                    party.partyTicks.tickUpper
                )
            )
        );
    }

    /// @notice Internal function to retrieve the fee growth inside the position from the last observation
    /// @param pool Address of the Uniswap V3 pool
    function _getFeeGrowthInsideLastX128(
        IUniswapV3Pool pool,
        bytes32 key
    )
        internal
        view
        returns (
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128
        )
    {
        (, feeGrowthInside0LastX128, feeGrowthInside1LastX128, , ) = pool.positions(key);
    }

    /// @notice Internal function to calculate the global fee growth
    /// @param pool Address of the Uniswap V3 pool
    function _calculateFeeGrowthGlobal(IUniswapV3Pool pool) internal view returns (uint256 feeGrowthGlobal) {
        if (pool.token0() == address(WBNB)) {
            (uint256 feeGrowthInside0LastX128,) = _getPartyFeeGrowthInsideLastX128(pool);
            feeGrowthGlobal = pool.feeGrowthGlobal0X128() - feeGrowthInside0LastX128;
        } else {
            (,uint256 feeGrowthInside1LastX128) = _getPartyFeeGrowthInsideLastX128(pool);
            feeGrowthGlobal = pool.feeGrowthGlobal1X128() - feeGrowthInside1LastX128;
        }
    }
}
