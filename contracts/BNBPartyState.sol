// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IBNBParty.sol";

abstract contract BNBPartyState is IBNBParty {
    INonfungiblePositionManager public immutable BNBPositionManager;
    INonfungiblePositionManager public immutable positionManager;
    mapping(address => bool) public isParty;
    mapping(address => uint256) public poolToTokenId;

    address public immutable WBNB;

    uint256 public immutable buyLimit;
    uint256 public immutable initialTokenAmount;

    uint24 public immutable fee;
    uint160 public immutable sqrtPriceX96;

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
}
