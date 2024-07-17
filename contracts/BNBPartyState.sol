// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@bnb-party/v3-periphery/contracts/interfaces/ISwapRouter.sol";

import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IBNBPartyFactory.sol";
import "./interfaces/IWBNB.sol";

abstract contract BNBPartyState is IBNBPartyFactory, Ownable {
    INonfungiblePositionManager public BNBPositionManager; // BNB Party position manager
    INonfungiblePositionManager public positionManager; // Default Pancakeswap V3 position manager
    ISwapRouter public swapRouter; // V3 swap router
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
            "BNBPartyFactory: positionManager already set"
        );
        positionManager = _positionManager;
        BNBPositionManager = _BNBPositionManager;
    }

    function setSwapRouter(ISwapRouter _swapRouter) external onlyOwner {
        require(
            _swapRouter != swapRouter,
            "BNBPartyFactory: swapRouter already set"
        );
        swapRouter = _swapRouter;
    }
}
