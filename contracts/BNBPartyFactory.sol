// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@pancakeswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./interfaces/INonfungiblePositionManager.sol";

contract BNBPartyFactory {
    INonfungiblePositionManager public immutable BNBPositionManager;
    INonfungiblePositionManager public immutable positionManager;

    uint256 public immutable buyLimit;
    uint256 public immutable initialTokenAmount;
    uint24 public immutable fee;

    event StartParty(
        address indexed tokenAddress,
        address indexed owner,
        address indexed FLPAddress
    );

    constructor(
        INonfungiblePositionManager _BNBPositionManager,
        INonfungiblePositionManager _positionManager,
        uint24 _fee,
        uint256 _buyLimit,
        uint256 _initialTokenAmount
    ) {
        require(
            address(_BNBPositionManager) != address(0),
            "BNBPositionManager is zero address"
        );
        require(
            address(_positionManager) != address(0),
            "positionManager is zero address"
        );
        require(_buyLimit > 0, "buyLimit is zero");
        require(_initialTokenAmount > 0, "initialTokenAmount is zero");
        BNBPositionManager = _BNBPositionManager;
        positionManager = _positionManager;
        fee = _fee;
        buyLimit = _buyLimit;
        initialTokenAmount = _initialTokenAmount;
    }

    function createToken(
        string calldata name,
        string calldata symbol
    ) public payable returns (IERC20 newToken) {
        require(msg.value >= fee, "Insufficient BNB for fee");
        newToken = new ERC20Token(name, symbol, initialTokenAmount);
        // emit StartParty(address(newToken), msg.sender, address(FLP));
        // create BNB party LP
    }

    function handleSwap() external {
        // handle swap
    }
}
