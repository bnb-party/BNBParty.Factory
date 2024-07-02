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
    mapping(address => bool) public reachedLimit;

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

    function swap(address token, uint256 amount) external payable {
        require(msg.value >= amount, "Insufficient BNB sent");

        checkAndTransferLiquidity(token);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: positionManager.WETH9(), // WETH9() can be replaced with address(0) for BNB
                tokenOut: token,
                fee: 3000,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: msg.value,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        pancakeRouter.exactInputSingle{value: msg.value}(params);

        emit SwapOperation(msg.sender, amount);
    }

    function checkAndTransferLiquidity(address token) internal {
        if (IERC20(token).balanceOf(pool) >= buyLimit && !reachedLimit[token]) {
            transferToRealPancakeSwap(token);
            reachedLimit[token] = true;
        }
    }

    function transferToRealPancakeSwap(address token) internal {
        uint256 contractTokenBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).approve(address(positionManager), contractTokenBalance);

        INonfungiblePositionManager.MintParams
            memory params = INonfungiblePositionManager.MintParams({
                token0: address(0), // WETH9() can be replaced with address(0) for BNB
                token1: token,
                fee: 3000,
                tickLower: -887272, // Adjust these values as necessary
                tickUpper: 887272, // Adjust these values as necessary
                amount0Desired: contractTokenBalance,
                amount1Desired: 0,
                amount0Min: 0,
                amount1Min: 0,
                recipient: factory,
                deadline: block.timestamp
            });

        positionManager.mint{value: 0}(params);

        emit LiquidityTransferred(token, contractTokenBalance);
    }

    receive() external payable {}
}
