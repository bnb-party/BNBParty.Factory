// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../interfaces/IBNBPartyFactory.sol";

contract MockContract {
    function callHandleSwap(IBNBPartyFactory factory) external {
        factory.handleSwap(msg.sender);
    }
}
