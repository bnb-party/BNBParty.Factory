// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@pancakeswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./PoolCreation.sol";

contract BNBPartyFactory is PoolCreation {
    address public immutable internalRouter;
    ISwapRouter public immutable swapRouter;
    uint256 public immutable buyLimit;
    uint256 public immutable initialTokenAmount;

    event TokenCreated(
        address indexed tokenAddress,
        string name,
        string symbol
    );

    constructor(
        address _internalRouter,
        address _swapRouter,
        address _positionManager,
        uint24 _fee,
        uint256 _buyLimit,
        uint256 _initialTokenAmount,
        uint160 _sqrtPriceLimitX96
    ) {
        internalRouter = _internalRouter;
        swapRouter = ISwapRouter(_swapRouter);
        positionManager = INonfungiblePositionManager(_positionManager);
        fee = _fee;
        buyLimit = _buyLimit;
        initialTokenAmount = _initialTokenAmount;
        sqrtPriceLimitX96 = _sqrtPriceLimitX96;
    }

    function createToken(
        string calldata name,
        string calldata symbol
    ) public payable returns (IERC20 newToken) {
        require(msg.value >= fee, "Insufficient BNB for fee");
        newToken = new ERC20Token(name, symbol, initialTokenAmount);
        emit TokenCreated(address(newToken), name, symbol);
        _addInitialLiquidity(newToken, initialTokenAmount);
    }
}
