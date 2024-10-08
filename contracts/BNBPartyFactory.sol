// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "./BNBPartyLiquidity.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@bnb-party/v3-periphery/contracts/interfaces/IPeripheryPayments.sol";

/// @title BNBPartyFactory
/// @notice This contract is used for creating and managing liquidity pools and custom ERC20 tokens on the Binance Smart Chain (BSC) using Uniswap V3 system.
contract BNBPartyFactory is BNBPartyLiquidity, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Allows the contract to receive BNB
    receive() external payable {}

    /// @notice Constructor to initialize the contract with party details and WBNB address
    /// @param _party The details of the party including initial token amount and other configurations
    /// @param _WBNB The address of the Wrapped BNB (WBNB) token contract
    constructor(
        Party memory _party,
        IWBNB _WBNB,
        ISqrtPriceCalculator _sqrtPriceCalculator
    ) BNBPartyState(_party, _WBNB, _sqrtPriceCalculator) {}

    /// @notice Creates a new party with a custom ERC20 token and initializes its liquidity pool
    /// @param name The name of the new ERC20 token
    /// @param symbol The symbol of the new ERC20 token
    /// @return newToken The address of the newly created ERC20 token
    function createParty(
        string calldata name,
        string calldata symbol
    )
        external
        payable
        override
        firewallProtected
        nonReentrant
        insufficientBNB(party.createTokenFee)
        whenNotPaused
        notZeroAddress(address(BNBPositionManager))
        returns (IERC20 newToken)
    {
        // Create new token
        newToken = new ERC20Token(name, symbol, party.initialTokenAmount);
        // Create First Liquidity Pool
        (address liquidityPool, uint256 tokenId) = _createFLP(address(newToken));
        lpToCreator[liquidityPool] = msg.sender; // Set the creator of the liquidity pool
        lpToTokenId[liquidityPool] = tokenId; // Set the token ID of the liquidity pool
        isParty[liquidityPool] = true; // Mark the liquidity pool as a party pool
        if (msg.value > party.createTokenFee) {
            _executeSwap(address(newToken));
        }
        emit StartParty(address(newToken), msg.sender, liquidityPool);
    }

    /// @notice Handles token swaps for the liquidity pool
    /// @param recipient The address of the entity making the exchange
    function handleSwap(address recipient) external override notZeroAddress(recipient) whenNotPaused {
        if (!isParty[msg.sender]) revert LPNotAtParty(); // Reverts if the LP is not part of a party
        IUniswapV3Pool pool = IUniswapV3Pool(msg.sender);

        uint256 WBNBBalance = WBNB.balanceOf(msg.sender);
        uint256 feeGrowthGlobal = _calculateFeeGrowthGlobal(pool);
        uint256 liquidity = pool.liquidity();
        uint256 feesEarned = calculateFees(liquidity, feeGrowthGlobal);

        if (WBNBBalance - feesEarned < party.partyTarget) return;
        // Handle liquidity
        (address liquidityPool, uint256 tokenId) = _handleLiquidity(recipient);
        lpToTokenId[liquidityPool] = tokenId;
    }

    /// @notice Allows users to join the party by swapping BNB for the specified token
    /// @param tokenOut The address of the token to receive in exchange for BNB
    /// @param amountOutMinimum The minimum amount of the token to receive
    function joinParty(
        address tokenOut,
        uint256 amountOutMinimum
    ) external payable notZeroAddress(tokenOut) notZeroValue {
        (ISwapRouter router, uint24 fee) = _getRouterAndFee(tokenOut);
        ISwapRouter.ExactInputParams memory params = ISwapRouter
            .ExactInputParams({
                path: abi.encodePacked(address(WBNB), fee, tokenOut),
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: msg.value,
                amountOutMinimum: amountOutMinimum
            });
        _executeSwap(router, params);
    }

    /// @notice Allows users to leave the party by swapping the specified token for BNB
    /// @param tokenIn The address of the token to swap for BNB
    /// @param amountIn The amount of the token to swap
    /// @param amountOutMinimum The minimum amount of BNB to receive
    function leaveParty(
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external notZeroAddress(tokenIn) notZeroAmount(amountIn) {
        (ISwapRouter router, uint24 fee) = _getRouterAndFee(tokenIn);
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeIncreaseAllowance(address(router), amountIn);

        ISwapRouter.ExactInputParams memory params = ISwapRouter
            .ExactInputParams({
                path: abi.encodePacked(tokenIn, fee, address(WBNB)),
                recipient: address(router),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum
            });
        _executeSwap(router, params);
        IPeripheryPayments(address(router)).unwrapWETH9(amountOutMinimum, msg.sender);
    }
}
