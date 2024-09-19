// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@ironblocks/firewall-consumer/contracts/FirewallConsumer.sol";
import "./interfaces/ISqrtPriceCalculator.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IWBNB.sol";
import "./BNBPartyModifiers.sol";

/// @title BNBPartyState
/// @notice This abstract contract handles the state variables and initial setup for the BNBParty system.
abstract contract BNBPartyState is BNBPartyModifiers, Ownable, FirewallConsumer {
    INonfungiblePositionManager public BNBPositionManager; // BNB Party position manager
    INonfungiblePositionManager public positionManager; // Default Pancakeswap V3 position manager
    ISwapRouter public BNBSwapRouter; // V3 swap router
    ISwapRouter public swapRouter; // Pancakeswap V3 router
    mapping(address => bool) public isParty; // Mapping to track if a LiquidityPool is a party
    mapping(address => uint256) public lpToTokenId; // Mapping from LiquidityPool to its NFT tokenId
    mapping(address => address) public lpToCreator; // Mapping from LiquidityPool to its creator
    mapping(address => bool) public isTokenTargetReached; // Mapping to track if a token has reached its target
    uint256 constant public FEE_GROWTH_GLOBAL_SCALE = 2**128;

    Party public party; // store party parameters

    ISqrtPriceCalculator public immutable sqrtPriceCalculator; // Sqrt price calculator contract
    IWBNB public immutable WBNB; // Wrapped BNB token contract

    /// @notice Constructor to initialize the BNBPartyState contract
    /// @param _party Struct containing party parameters
    /// @param _WBNB Address of the Wrapped BNB token contract
    constructor(
        Party memory _party,
        IWBNB _WBNB,
        ISqrtPriceCalculator _sqrtPriceCalculator
    ) Ownable(_msgSender()) {
        _constructorValidation(_party, _WBNB, _sqrtPriceCalculator);
        party = _party;
        WBNB = _WBNB;
        sqrtPriceCalculator = _sqrtPriceCalculator;
    }

    function _constructorValidation(
        Party memory _party,
        IWBNB _WBNB,
        ISqrtPriceCalculator _sqrtPriceCalculator
    )
        private
        pure
        notZeroAddress(address(_WBNB))
        notZeroAddress(address(_sqrtPriceCalculator))
        notZeroAmount(_party.partyTarget)
        notZeroAmount(_party.initialTokenAmount)
        notZeroAmount(_party.sqrtPriceX96)
    {
        if (_party.partyTarget <= (_party.bonusPartyCreator + _party.bonusTargetReach + _party.targetReachFee)) {
            revert BonusGreaterThanTarget(); // Reverts if the party target is less than or equal to the sum of bonuses and fees
        }
    }
}
