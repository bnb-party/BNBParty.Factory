// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISqrtPriceCalculator {
    function getNextSqrtPriceFromAmount0RoundingUp(
        uint160 sqrtPX96,
        uint128 liquidity,
        uint256 amount,
        bool add
    ) external pure returns (uint160 sqrtQX96);

    function getNextSqrtPriceFromAmount1RoundingDown(
        uint160 sqrtPX96,
        uint128 liquidity,
        uint256 amount,
        bool add
    ) external pure returns (uint160 sqrtQX96);
}
