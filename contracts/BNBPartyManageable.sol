// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyModifiers.sol";

/// @title BNBPartyManageable
/// @notice This abstract contract provides management functions for setting position managers, swap routers, and withdrawing fees in the BNBParty system.
abstract contract BNBPartyManageable is BNBPartyModifiers {
    /// @notice Sets the non-fungible position managers for BNB Party and Pancakeswap V3
    /// @param _BNBPositionManager Address of the new BNB Party non-fungible position manager
    /// @param _positionManager Address of the new Pancakeswap V3 non-fungible position manager
    /// @dev Reverts if the provided managers are the same as the current ones
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

    /// @notice Sets the swap router address
    /// @param _swapRouter Address of the new swap router
    /// @dev Reverts if the new swap router is identical to the current one
    function setSwapRouter(ISwapRouter _swapRouter) external onlyOwner {
        if (_swapRouter == BNBSwapRouter) {
            revert SwapRouterAlreadySet();
        }
        BNBSwapRouter = _swapRouter;
    }

    /// @notice Withdraws the balance of BNB from token creation fees
    /// @dev Reverts if the contract balance is zero
    function withdrawFee() external onlyOwner {
        if (address(this).balance == 0) {
            revert ZeroAmount();
        }
        payable(msg.sender).transfer(address(this).balance); // Transfers the entire BNB balance to the owner
        emit TransferOutBNB(msg.sender, address(this).balance); // Emits an event indicating the transfer of BNB
    }

    /// @notice Withdraws LP fees from the BNB Party for specified liquidity pools
    /// @param liquidityPools Array of liquidity pool addresses from which fees will be withdrawn
    function withdrawPartyLPFee(
        address[] calldata liquidityPools
    ) external onlyOwner {
        _withdrawLPFees(liquidityPools, BNBPositionManager);
    }

    /// @notice Withdraws LP fees from Pancakeswap V3 for specified liquidity pools
    /// @param liquidityPools Array of liquidity pool addresses from which fees will be withdrawn
    function withdrawLPFee(address[] calldata liquidityPools) external onlyOwner {
        _withdrawLPFees(liquidityPools, positionManager);
    }

    /// @notice Internal function to withdraw LP fees from specified liquidity pools
    /// @param liquidityPools Array of liquidity pool addresses from which fees will be withdrawn
    /// @param manager The non-fungible position manager used to collect fees
    /// @dev Reverts if the liquidity pools array is empty
    function _withdrawLPFees(
        address[] calldata liquidityPools,
        INonfungiblePositionManager manager
    ) internal {
        if (liquidityPools.length == 0) {
            revert ZeroLength();
        }
        for (uint256 i = 0; i < liquidityPools.length; ++i) {
            _collectFee(liquidityPools[i], manager); // Collects fees from each specified liquidity pool
        }
    }

    /// @notice Internal function to collect LP fees from a specific liquidity pool
    /// @param liquidityPool Address of the liquidity pool from which fees will be collected
    /// @param manager The non-fungible position manager used to collect fees
    /// @dev Reverts if the provided liquidity pool address is zero
    function _collectFee(
        address liquidityPool,
        INonfungiblePositionManager manager
    ) internal notZeroAddress(liquidityPool) {
        manager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: lpToTokenId[liquidityPool],
                recipient: msg.sender,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        ); // Collects fees from the specified liquidity pool
    }
}
