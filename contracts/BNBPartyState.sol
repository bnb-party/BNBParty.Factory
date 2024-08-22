// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@bnb-party/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./interfaces/ISqrtPriceCalculator.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IBNBPartyFactory.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./interfaces/IWBNB.sol";

/// @title BNBPartyState
/// @notice This abstract contract handles the state variables and initial setup for the BNBParty system.
abstract contract BNBPartyState is IBNBPartyFactory, Ownable {
    INonfungiblePositionManager public BNBPositionManager; // BNB Party position manager
    INonfungiblePositionManager public positionManager; // Default Pancakeswap V3 position manager
    ISwapRouter public BNBSwapRouter; // V3 swap router
    ISwapRouter public swapRouter; // Pancakeswap V3 router
    mapping(address => bool) public isParty; // Mapping to track if a LiquidityPool is a party
    mapping(address => uint256) public lpToTokenId; // Mapping from LiquidityPool to its NFT tokenId
    mapping(address => address) public lpToCreator; // Mapping from LiquidityPool to its creator
    mapping(address => bool) public isTokenOnPartyLP; // Mapping to track if a token is part of a party
    ISqrtPriceCalculator public sqrtPriceCalculator;

    Party public party; // store party parameters

    IWBNB public immutable WBNB; // Wrapped BNB token contract

    /// @notice Constructor to initialize the BNBPartyState contract
    /// @param _party Struct containing party parameters
    /// @param _WBNB Address of the Wrapped BNB token contract
    constructor(Party memory _party, IWBNB _WBNB, ISqrtPriceCalculator _sqrtPriceCalculator) Ownable(_msgSender()) {
        if (address(_WBNB) == address(0)) {
            revert ZeroAddress(); // Reverts if the WBNB address is zero
        }
        if(address(_sqrtPriceCalculator) == address(0)) {
            revert ZeroAddress(); // Reverts if the sqrt price calculator address is zero
        }
        if (_party.partyTarget == 0) {
            revert ZeroAmount(); // Reverts if the party target is zero
        }
        if (_party.initialTokenAmount == 0) {
            revert ZeroAmount(); // Reverts if the initial token amount is zero
        }
        if (_party.partyTarget <= (_party.bonusPartyCreator + _party.bonusTargetReach + _party.targetReachFee)) {
            revert BonusGreaterThanTarget(); // Reverts if the party target is less than or equal to the sum of bonuses and fees
        }
        if (_party.sqrtPriceX96 == 0) {
            revert ZeroAmount(); // Reverts if the sqrt price is zero
        }
        party = _party;
        WBNB = _WBNB;
        sqrtPriceCalculator = _sqrtPriceCalculator;
    }
}
