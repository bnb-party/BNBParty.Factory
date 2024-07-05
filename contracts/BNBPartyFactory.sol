// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "./interfaces/IBNBParty.sol";
import "./interfaces/INonfungiblePositionManager.sol";

contract BNBPartyFactory is IBNBParty {
    INonfungiblePositionManager public immutable BNBPositionManager;
    INonfungiblePositionManager public immutable positionManager;
    mapping(address => bool) public isParty;

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
    ) public payable override returns (IERC20 newToken) {
        require(msg.value >= fee, "Insufficient BNB for fee");
        newToken = new ERC20Token(name, symbol, initialTokenAmount);
        address liquidityPool = _createLP();
        emit StartParty(address(newToken), msg.sender, liquidityPool);
    }

    function handleSwap() external override {
        require(isParty[msg.sender], "LP is not at the party");
    }

    function _createLP() internal returns (address liquidityPool) {
        isParty[liquidityPool] = true;
    }
}
