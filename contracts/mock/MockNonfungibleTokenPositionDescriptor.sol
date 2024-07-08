// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../interfaces/INonfungiblePositionManager.sol";

contract MockNonfungibleTokenPositionDescriptor {
    function tokenURI(
        INonfungiblePositionManager,
        uint256
    ) external view returns (string memory) {
        // do nothing
    }
}
