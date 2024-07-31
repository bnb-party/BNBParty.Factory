// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyModifiers.sol";

abstract contract BNBPartyView is BNBPartyModifiers {
    function isToken0WBNB(
        IUniswapV3Pool liquidtyPool
    ) public view returns (bool) {
        if (liquidtyPool == IUniswapV3Pool(address(0))) {
            revert ZeroAddress();
        }
        return liquidtyPool.token0() == address(WBNB);
    }

    function calculateFees(
        uint256 liquidity,
        uint256 feeGrowthGlobalX128
    ) public pure returns (uint256 feesEarned) {
        feesEarned = (feeGrowthGlobalX128 * liquidity) / 2 ** 128;
    }

    function getFeeGrowthInsideLastX128(
        IUniswapV3Pool pool
    )
        external
        view
        returns (
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128
        )
    {
        if (pool == IUniswapV3Pool(address(0))) return (0, 0);
        (
            feeGrowthInside0LastX128,
            feeGrowthInside1LastX128
        ) = _getFeeGrowthInsideLastX128(pool);
    }

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
        (, feeGrowthInside0LastX128, feeGrowthInside1LastX128, , ) = pool
            .positions(
                keccak256(
                    abi.encodePacked(
                        address(BNBPositionManager),
                        party.tickLower,
                        party.tickUpper
                    )
                )
            );
    }
}
