// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IBNBParty.sol";
import "./interfaces/IWBNB.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract BNBPartyState is IBNBParty, Ownable {
    INonfungiblePositionManager public BNBPositionManager; // BNB Party position manager
    INonfungiblePositionManager public positionManager; // Default Pancakeswap V3 position manager
    mapping(address => bool) public isParty; // LiquidityPool => isParty
    mapping(address => uint256) public lpToTokenId; // LiquidityPool => nft tokenId

    IWBNB public immutable WBNB;

    uint256 public immutable partyTarget;
    uint256 public immutable initialTokenAmount;
    uint256 public immutable returnAmount;

    uint256 public immutable createTokenFee;
    uint24 public immutable partyLPFee;
    uint24 public immutable lpFee;

    int24 public immutable tickLower;
    int24 public immutable tickUpper;
    uint160 public immutable sqrtPriceX96;
    uint256 public immutable bonusTargetReach;
    uint256 public immutable bonusPartyCreator;

    constructor(
        uint256 _partyTarget,
        uint256 _createTokenFee,
        uint24 _partyLpFee,
        uint24 _lpFee,
        uint256 _initialTokenAmount,
        uint160 _sqrtPriceX96,
        IWBNB _WBNB,
        uint256 _bonusTargetReach,
        uint256 _bonusPartyCreator,
        int24 _tickLower,
        int24 _tickUpper
    ) Ownable(_msgSender()) {
        require(_partyTarget > 0, "buyLimit is zero");
        require(_initialTokenAmount > 0, "initialTokenAmount is zero");
        require(
            _partyTarget > _bonusPartyCreator,
            "partyTarget is less than bonusParty"
        );
        lpFee = _lpFee;
        partyTarget = _partyTarget;
        initialTokenAmount = _initialTokenAmount;
        sqrtPriceX96 = _sqrtPriceX96;
        partyLPFee = _partyLpFee;
        WBNB = _WBNB;
        returnAmount = _bonusPartyCreator;
        createTokenFee = _createTokenFee;
        bonusTargetReach = _bonusTargetReach;
        bonusPartyCreator = _bonusPartyCreator;
        tickLower = _tickLower;
        tickUpper = _tickUpper;
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
