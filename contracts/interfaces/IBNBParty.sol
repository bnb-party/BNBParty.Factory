// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
interface IBNBParty {
    /// @notice create token and initial LP
    /// @param name token name
    /// @param symbol token symbol
    /// @return newToken created token
    function createToken(
        string calldata name,
        string calldata symbol
    ) external payable returns (IERC20 newToken);

    /// @notice handle party swap for FLP
    function handleSwap(address recipient) external;
}
