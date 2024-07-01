// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@pancakeswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./interfaces/INonfungiblePositionManager.sol";

contract BNBPartyFactory {
    address public internalRouter;
    ISwapRouter public swapRouter;
    INonfungiblePositionManager public positionManager;
    uint256 public fee;
    uint256 public buyLimit;
    uint256 public initialTokenAmount;

    event TokenCreated(address tokenAddress, string name, string symbol);

    constructor(
        address _internalRouter,
        address _swapRouter,
        address _positionManager,
        uint256 _fee,
        uint256 _buyLimit,
        uint256 _initialTokenAmount
    ) {
        internalRouter = _internalRouter;
        swapRouter = ISwapRouter(_swapRouter);
        positionManager = INonfungiblePositionManager(_positionManager);
        fee = _fee;
        buyLimit = _buyLimit;
        initialTokenAmount = _initialTokenAmount;
    }

    function createToken(
        string memory name,
        string memory symbol
    ) public payable returns (ERC20Token newToken) {
        require(msg.value >= fee, "Insufficient BNB for fee");
        newToken = new ERC20Token(name, symbol, initialTokenAmount);
        emit TokenCreated(address(newToken), name, symbol);
        addInitialLiquidity(address(newToken), initialTokenAmount);
    }

    function addInitialLiquidity(
        address tokenAddress,
        uint256 amount
    ) internal {
        ERC20 token = ERC20(tokenAddress);
        token.approve(address(positionManager), amount);
        positionManager.createAndInitializePoolIfNecessary(
            tokenAddress,
            positionManager.WETH9(),
            3000, // Fee tier
            1 ether // Price
        );
        INonfungiblePositionManager.MintParams
            memory params = INonfungiblePositionManager.MintParams({
                token0: tokenAddress,
                token1: positionManager.WETH9(),
                fee: 3000, // Fee tier
                tickLower: -887272, // Lower tick
                tickUpper: 887272, // Upper tick
                amount0Desired: amount,
                amount1Desired: 0,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            });
        positionManager.mint{value: 0}(params);
    }
}
