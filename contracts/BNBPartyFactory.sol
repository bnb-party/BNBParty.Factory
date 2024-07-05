// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "./interfaces/IBNBParty.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./interfaces/INonfungiblePositionManager.sol";

contract BNBPartyFactory is IBNBParty {
    INonfungiblePositionManager public immutable BNBPositionManager;
    INonfungiblePositionManager public immutable positionManager;
    mapping(address => bool) public isParty;

    address public immutable WBNB;

    uint256 public immutable buyLimit;
    uint256 public immutable initialTokenAmount;

    uint24 public immutable fee;
    uint160 public immutable sqrtPriceX96;

    event StartParty(
        address indexed tokenAddress,
        address indexed owner,
        address indexed FLPAddress
    );

    constructor(
        INonfungiblePositionManager _BNBPositionManager,
        INonfungiblePositionManager _positionManager,
        uint24 _fee,
        uint256 _buyLimit,
        uint256 _initialTokenAmount,
        uint160 _sqrtPriceX96,
        address _WBNB
    ) {
        require(
            address(_BNBPositionManager) != address(0),
            "BNBPositionManager is zero address"
        );
        require(
            address(_positionManager) != address(0),
            "positionManager is zero address"
        );
        require(_buyLimit > 0, "buyLimit is zero");
        require(_initialTokenAmount > 0, "initialTokenAmount is zero");
        BNBPositionManager = _BNBPositionManager;
        positionManager = _positionManager;
        fee = _fee;
        buyLimit = _buyLimit;
        initialTokenAmount = _initialTokenAmount;
        sqrtPriceX96 = _sqrtPriceX96;
        WBNB = _WBNB;
    }

    function createToken(
        string calldata name,
        string calldata symbol
    ) public payable override returns (IERC20 newToken) {
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
            // remove liquidity from old pool
            // create new LP
            _createLP(positionManager, token0, token1, amount0, amount1);
        }
    }

    function _createFLP(
        address _token
    ) internal returns (address liquidityPool) {
        uint256 amount1 = IERC20(_token).balanceOf(address(this));
        liquidityPool = _createLP(BNBPositionManager, WBNB, _token, 0, amount1);
        isParty[liquidityPool] = true;
    }

    function _createLP(
        INonfungiblePositionManager liquidityManager,
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1
    ) internal returns (address liquidityPool) {
        // create LP
        liquidityPool = liquidityManager.createAndInitializePoolIfNecessary(
            token0,
            token1,
            fee,
            sqrtPriceX96
        );
        // mint LP
        liquidityManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: fee,
                tickLower: -887272,
                tickUpper: 887272,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: amount0,
                amount1Min: amount1,
                recipient: address(this),
                deadline: block.timestamp
            })
        );
    }
}
