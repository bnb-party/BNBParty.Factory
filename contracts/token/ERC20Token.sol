// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract ERC20Token is ERC20, ERC20Burnable {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialAmount
    ) ERC20(string(abi.encodePacked(_name, " Party")), _symbol) {
        _mint(msg.sender, _initialAmount);
    }
}
