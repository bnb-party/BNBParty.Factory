// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@bnb-party/v3-core/contracts/libraries/SqrtPriceMath.sol";

library SqrtPriceCalculator {
    function getNextSqrtPriceFromAmount0RoundingUp(
        uint160 sqrtPX96,
        uint128 liquidity,
        uint256 amount,
        bool add
    ) external pure returns (uint160 sqrtPriceX96) {
        sqrtPriceX96 = SqrtPriceMath.getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amount, add);
    }

    function getNextSqrtPriceFromAmount1RoundingDown(
        uint160 sqrtPX96,
        uint128 liquidity,
        uint256 amount,
        bool add
    ) external pure returns (uint160 sqrtPriceX96) {
        sqrtPriceX96 = SqrtPriceMath.getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amount, add);
    }
}
