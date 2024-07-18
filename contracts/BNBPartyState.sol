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
        if (address(_WBNB) == address(0)) {
            revert ZeroAddress();
        }
        if (_party.partyTarget == 0) {
            revert ZeroAmount();
        }
        if (_party.initialTokenAmount == 0) {
            revert ZeroAmount();
        }
        if (_party.partyTarget <= _party.bonusPartyCreator) {
            revert BonusGreaterThanTarget();
        }
        if (_party.sqrtPriceX96 == 0) {
            revert ZeroAmount();
        }
        party = _party;
        WBNB = _WBNB;
    }

    function setNonfungiblePositionManager(
        INonfungiblePositionManager _BNBPositionManager,
        INonfungiblePositionManager _positionManager
    ) external onlyOwner {
        if (_BNBPositionManager == BNBPositionManager && _positionManager == positionManager) {
            revert PositionManagerAlreadySet();
        }
        positionManager = _positionManager;
        BNBPositionManager = _BNBPositionManager;
    }

    function setSwapRouter(ISwapRouter _swapRouter) external onlyOwner {
        if (_swapRouter == swapRouter) {
            revert SwapRouterAlreadySet();
        }
        swapRouter = _swapRouter;
    }
}
