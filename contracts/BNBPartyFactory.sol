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
        IWBNB _WBNB,
        uint256 _returnAmount
    )
        BNBPartyState(
            _BNBPositionManager,
            _positionManager,
            _fee,
            _buyLimit,
            _initialTokenAmount,
            _sqrtPriceX96,
            _WBNB,
            _returnAmount
        )
    {}

    function createParty(
        string calldata name,
        string calldata symbol
    ) external payable override returns (IERC20 newToken) {
        // create new token
        newToken = new ERC20Token(name, symbol, initialTokenAmount);
        // create First Liquidity Pool
        address liquidityPool = _createFLP(newToken);
        emit StartParty(address(newToken), msg.sender, liquidityPool);
    }

    function handleSwap(address recipient) external override {
        require(isParty[msg.sender], "LP is not at the party");

        uint256 WBNBBalance = WBNB.balanceOf(msg.sender);
        if (WBNBBalance < buyLimit) return;
        // uwrap return amount WBNB and send to recipient
        WBNB.withdraw(returnAmount);
        (bool success, ) = recipient.call{value: returnAmount}("");
        require(success, "Transfer failed.");

        IUniswapV3Pool pool = IUniswapV3Pool(msg.sender);
        // Decrease liquidity from the old pool
        (uint256 amount0, uint256 amount1) = BNBPositionManager
            .decreaseLiquidity(
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: poolToTokenId[msg.sender],
                    liquidity: pool.liquidity(),
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                })
            );
        address token1 = pool.token1();
        // Create new LP
        _createLP(positionManager, token1, amount0, amount1);
    }
}
