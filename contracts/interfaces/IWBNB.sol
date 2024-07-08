// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Interface for WBNB
interface IWBNB is IERC20 {
    /// @notice Deposit bnb to get wrapped bnb
    function deposit() external payable;

    /// @notice Withdraw wrapped bnb to get bnb
    function withdraw(uint256) external;
}
