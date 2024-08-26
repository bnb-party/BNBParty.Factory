// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title ERC20Token
/// @notice This contract is a basic ERC20 token with burnable capabilities, used in the BNB Party system.
contract ERC20Token is ERC20, ERC20Burnable {
    /// @notice Constructs the ERC20 token with a name, symbol, and initial supply.
    /// @param tokenName The name of the token
    /// @param tokenSymbol The symbol of the token
    /// @param initialAmount The initial amount of tokens to mint to the deployer's address
    /// @dev The token name ends with " Party"
    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint256 initialAmount
    ) ERC20(string(abi.encodePacked(tokenName, " Party")), tokenSymbol) {
        _mint(msg.sender, initialAmount); // Mint the initial supply to the deployer's address
    }
}
