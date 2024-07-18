// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyState.sol";

abstract contract BNBPartyModifiers is BNBPartyState {
    modifier onlyParty() {
        if (!isParty[msg.sender]) revert LPNotAtParty();
        _;
    }

    modifier notZeroAddress(address _address) {
        if (_address == address(0)) revert ZeroAddress();
        _;
    }

    modifier insufficientBNB() {
        if (msg.value < party.createTokenFee) revert InsufficientBNB();
        _;
    }

    modifier notZeroAmount(uint256 _amount) {
        if (_amount == 0) revert ZeroAmount();
        _;
    }
}
