// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "./BNBPartyInternal.sol";

contract BNBPartyFactory is BNBPartyInternal {
    constructor(
        INonfungiblePositionManager _BNBPositionManager,
        INonfungiblePositionManager _positionManager,
        uint24 _fee,
        uint256 _buyLimit,
        uint256 _initialTokenAmount,
        uint160 _sqrtPriceX96,
        address _WBNB
    )
        BNBPartyState(
            _BNBPositionManager,
            _positionManager,
            _fee,
            _buyLimit,
            _initialTokenAmount,
            _sqrtPriceX96,
            _WBNB
        )
    {}

    function createToken(
        string calldata name,
        string calldata symbol
    ) external payable override returns (IERC20 newToken) {
        require(msg.value >= fee, "Insufficient BNB for fee");

        newToken = new ERC20Token(name, symbol, initialTokenAmount);
        address liquidityPool = _createFLP(address(newToken));

        emit StartParty(address(newToken), msg.sender, liquidityPool);
    }

    function handleSwap(address recipient) external override {
        require(isParty[msg.sender], "LP is not at the party");

        address token0 = IUniswapV3Pool(msg.sender).token0();
        address token1 = IUniswapV3Pool(msg.sender).token1();
        uint256 amount0 = IERC20(token0).balanceOf(msg.sender);
        uint256 amount1 = IERC20(token1).balanceOf(msg.sender);

        if (
            (token0 == WBNB && amount0 >= buyLimit) ||
            (token1 == WBNB && amount1 >= buyLimit)
        ) {
            // Decrease liquidity from the old pool
            BNBPositionManager.decreaseLiquidity(
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: poolToTokenId[msg.sender],
                    liquidity: IUniswapV3Pool(msg.sender).liquidity(),
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                })
            );
            // Create new LP
            _createLP(positionManager, token0, token1, amount0, amount1);
        }
    }
}
