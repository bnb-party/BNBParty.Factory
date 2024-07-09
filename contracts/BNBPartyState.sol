// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IBNBParty.sol";
import "./interfaces/IWBNB.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract BNBPartyState is IBNBParty, Ownable {
    INonfungiblePositionManager public BNBPositionManager;
    INonfungiblePositionManager public positionManager;
    mapping(address => bool) public isParty;
    mapping(address => uint256) public poolToTokenId;

    IWBNB public immutable WBNB;

    uint256 public immutable buyLimit;
    uint256 public immutable initialTokenAmount;
    uint256 public immutable returnAmount;

    uint24 public immutable fee;
    uint160 public immutable sqrtPriceX96;

    constructor(
        uint24 _fee,
        uint256 _buyLimit,
        uint256 _initialTokenAmount,
        uint160 _sqrtPriceX96,
        IWBNB _WBNB,
        uint256 _returnAmount
    ) Ownable(_msgSender()) {
        require(_buyLimit > 0, "buyLimit is zero");
        require(_initialTokenAmount > 0, "initialTokenAmount is zero");
        require(
            _buyLimit > _returnAmount,
            "buyLimit is less than returnAmount"
        );
        fee = _fee;
        buyLimit = _buyLimit;
        initialTokenAmount = _initialTokenAmount;
        sqrtPriceX96 = _sqrtPriceX96;
        WBNB = _WBNB;
        returnAmount = _returnAmount;
    }

    function setNonfungiblePositionManager(
        INonfungiblePositionManager _BNBPositionManager,
        INonfungiblePositionManager _positionManager
    ) external onlyOwner {
        require(
            _BNBPositionManager != BNBPositionManager &&
                _positionManager != positionManager,
            "BNBPartyState: already set"
        );
        positionManager = _positionManager;
        BNBPositionManager = _BNBPositionManager;
    }
}
