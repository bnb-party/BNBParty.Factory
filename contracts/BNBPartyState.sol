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

    Party public party;

    IWBNB public immutable WBNB;

    constructor(Party memory _party, IWBNB _WBNB) Ownable(_msgSender()) {
        require(_party.partyTarget > 0, "buyLimit is zero");
        require(_party.initialTokenAmount > 0, "initialTokenAmount is zero");
        require(
            _party.partyTarget > _party.bonusPartyCreator,
            "partyTarget is less than bonusParty"
        );
        require(_party.sqrtPriceX96 > 0, "sqrtPriceX96 is zero");
        party = _party;
        WBNB = _WBNB;
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
