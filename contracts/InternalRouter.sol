// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@pancakeswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "./PoolCreation.sol";

contract InternalRouter is PoolCreation {
    ISwapRouter public pancakeRouter;
    address public factory;
    uint256 public buyLimit;
    address pool;
    uint256 public immutable initialTokenAmount;
    mapping(IERC20 => bool) public reachedLimit;

    event SwapOperation(address indexed user, uint256 amount);
    event LiquidityTransferred(address token, uint256 amount);

    constructor(
        address _pancakeRouter,
        address _pool,
        address _positionManager,
        uint256 _buyLimit,
        address _factory
    ) {
        pancakeRouter = ISwapRouter(_pancakeRouter);
        positionManager = INonfungiblePositionManager(_positionManager);
        buyLimit = _buyLimit;
        factory = _factory;
        pool = _pool;
    }

    function swap(IERC20 token, uint256 amount) external payable {
        require(msg.value >= amount, "Insufficient BNB sent");

        checkAndTransferLiquidity(token);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: positionManager.WETH9(),
                tokenOut: address(token),
                fee: fee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: msg.value,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            });

        pancakeRouter.exactInputSingle{value: msg.value}(params);

        emit SwapOperation(msg.sender, amount);
    }

    function checkAndTransferLiquidity(IERC20 token) internal {
        if (token.balanceOf(pool) >= buyLimit && !reachedLimit[token]) {
            createRealPool(token);
            reachedLimit[token] = true;
        }
    }

    function createRealPool(IERC20 token) internal {
        _addInitialLiquidity(token, initialTokenAmount);
    }

    receive() external payable {}
}
