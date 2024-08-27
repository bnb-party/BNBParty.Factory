// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyState.sol";

/// @title BNBPartyModifiers
/// @notice This abstract contract provides various modifiers used in the BNBParty system to enforce conditions on function calls.
abstract contract BNBPartyModifiers is BNBPartyState {
    /// @notice Restricts function access to liquidity pools that are part of a party
    /// @dev Reverts if the caller is not a registered party liquidity pool
    modifier onlyParty() {
        if (!isParty[msg.sender]) revert LPNotAtParty();
        _;
    }

    /// @notice Ensures the provided address is not a zero address
    /// @param _address Address to be checked
    /// @dev Reverts if the address is zero
    modifier notZeroAddress(address _address) {
        if (_address == address(0)) revert ZeroAddress(); // Reverts if the provided address is zero
        _;
    }

    /// @notice Ensures the amount of BNB sent is sufficient to cover the token creation fee
    /// @dev Reverts if the sent BNB is less than the required fee
    modifier insufficientBNB() {
        if (msg.value < party.createTokenFee) revert InsufficientBNB();
        _;
    }

    /// @notice Ensures the provided amount is not zero
    /// @param _amount Amount to be checked
    /// @dev Reverts if the amount is zero
    modifier notZeroAmount(uint256 _amount) {
        if (_amount == 0) revert ZeroAmount();
        _;
    }

    /// @notice Ensures the provided amount is not zero
    /// @dev Reverts if the amount is zero
    modifier notZeroBNB() {
        if (address(this).balance > 0) {
            _;
           return;
        }
        revert ZeroAmount();
    }

    /// @notice Ensures that some value (BNB) is sent with the transaction
    /// @dev Reverts if no value is sent
    modifier notZeroValue() {
        if (msg.value == 0) revert ZeroAmount();
        _;
    }

    /// @notice Ensures the swap router is not already set
    modifier swapRouterAlreadySet(
        ISwapRouter _swapRouter,
        ISwapRouter _newSwapRouter
    ) {
        if (_swapRouter == _newSwapRouter) {
            revert AlreadySet();
        }
        _;
    }
}
