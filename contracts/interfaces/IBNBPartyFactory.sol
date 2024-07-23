// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
interface IBNBPartyFactory {
    /// @notice create token and initial LP
    /// @param name token name
    /// @param symbol token symbol
    /// @return newToken created token
    function createParty(
        string calldata name,
        string calldata symbol
    ) external payable returns (IERC20 newToken);

    /// @notice handle party swap for FLP
    function handleSwap(address recipient) external;

    struct Party {
        uint256 partyTarget;
        uint256 createTokenFee;
        uint24 partyLpFee;
        uint24 lpFee;
        uint256 initialTokenAmount;
        uint160 sqrtPriceX96;
        uint256 bonusTargetReach;
        uint256 bonusPartyCreator;
        uint256 targetReachFee;
        int24 tickLower;
        int24 tickUpper;
    }

    /// @notice event emitted when a party is started
    /// @param tokenAddress ERC20 token address
    /// @param owner the owner of the party
    /// @param FLPAddress the address of the Liquidity Pool
    event StartParty(
        address indexed tokenAddress,
        address indexed owner,
        address indexed FLPAddress
    );

    /// @notice event emitted when a bonus is sent
    /// @param recipient the recipient of the bonus
    /// @param amount the amount of the bonus
    event SendBonus(address indexed recipient, uint256 amount);

    error InsufficientBNB();
    error ZeroAddress();
    error ZeroAmount();
    error BonusGreaterThanTarget();
    error PositionManagerNotSet();
    error PositionManagerAlreadySet();
    error SwapRouterAlreadySet();
    error LPNotAtParty();
    error BonusAmountTransferFailed();
}
