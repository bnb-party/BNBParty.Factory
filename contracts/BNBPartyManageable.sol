// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyFee.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title BNBPartyManageable
/// @notice This abstract contract provides management functions for setting position managers, swap routers, and withdrawing fees in the BNBParty system.
abstract contract BNBPartyManageable is BNBPartyFee, Pausable {
    /// @notice Sets the non-fungible position managers for BNB Party and Pancakeswap V3
    /// @param _BNBPositionManager Address of the new BNB Party non-fungible position manager
    /// @param _positionManager Address of the new Pancakeswap V3 non-fungible position manager
    /// @dev Reverts if the provided managers are the same as the current ones
    function setNonfungiblePositionManager(
        INonfungiblePositionManager _BNBPositionManager,
        INonfungiblePositionManager _positionManager
    ) external onlyOwner firewallProtected {
        if (_BNBPositionManager == BNBPositionManager && _positionManager == positionManager) {
            revert PositionManagerAlreadySet();
        }
        positionManager = _positionManager;
        BNBPositionManager = _BNBPositionManager;
    }

    /// @notice Sets the swap router address
    /// @param _swapRouter Address of the new swap router
    /// @dev Reverts if the new swap router is identical to the current one
    function setBNBPartySwapRouter(
        ISwapRouter _swapRouter
    ) external onlyOwner firewallProtected swapRouterAlreadySet(_swapRouter, BNBSwapRouter) {
        BNBSwapRouter = _swapRouter;
    }

    function setSwapRouter(
        ISwapRouter _swapRouter
    ) external onlyOwner firewallProtected swapRouterAlreadySet(_swapRouter, swapRouter) {
        swapRouter = _swapRouter;
    }

    /// @notice Withdraws the balance of BNB from token creation fees
    /// @dev Reverts if the contract balance is zero
    function withdrawFee() external onlyOwner firewallProtected {
        if (address(this).balance > 0) {
            emit TransferOutBNB(msg.sender, address(this).balance); // Emits an event indicating the transfer of BNB
            payable(msg.sender).transfer(address(this).balance); // Transfers the entire BNB balance to the owner
        }
    }

    /// @notice Withdraws LP fees from the BNB Party for specified liquidity pools
    /// @param liquidityPools Array of liquidity pool addresses from which fees will be withdrawn
    function withdrawPartyLPFee(
        address[] calldata liquidityPools
    ) external onlyOwner firewallProtected {
        _withdrawLPFees(liquidityPools, BNBPositionManager);
    }

    /// @notice Withdraws LP fees from Pancakeswap V3 for specified liquidity pools
    /// @param liquidityPools Array of liquidity pool addresses from which fees will be withdrawn
    function withdrawLPFee(address[] calldata liquidityPools) external onlyOwner firewallProtected {
        _withdrawLPFees(liquidityPools, positionManager);
    }

    /// @notice Pauses the contract
    function pause() external onlyOwner firewallProtected {
        _pause();
    }

    /// @notice Unpauses the contract
    function unpause() external onlyOwner firewallProtected {
        _unpause();
    }
}
