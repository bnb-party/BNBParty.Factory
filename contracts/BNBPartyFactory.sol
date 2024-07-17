// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "./BNBPartyInternal.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BNBPartyFactory is BNBPartyInternal, ReentrancyGuard {
    constructor(
        Party memory _party,
        IWBNB _WBNB
    ) BNBPartyState(_party, _WBNB) {}

    function createParty(
        string calldata name,
        string calldata symbol
    ) external payable override nonReentrant returns (IERC20 newToken) {
        require(
            msg.value >= party.createTokenFee,
            "BNBPartyFactory: insufficient BNB"
        );
        require(
            address(BNBPositionManager) != address(0),
            "BNBPartyFactory: BNBPositionManager not set"
        );
        // create new token
        newToken = new ERC20Token(name, symbol, party.initialTokenAmount);
        // create First Liquidity Pool
        address liquidityPool = _createFLP(address(newToken));
        if (msg.value > party.createTokenFee) {
            _executeSwap(address(newToken));
        }
        emit StartParty(address(newToken), msg.sender, liquidityPool);
    }

    function handleSwap(address recipient) external override {
        require(isParty[msg.sender], "LP is not at the party");

        uint256 WBNBBalance = WBNB.balanceOf(msg.sender);
        if (WBNBBalance < party.partyTarget) return;

        // uwrap return amount WBNB and send to recipient
        _unwrapAndSendBNB(recipient);

        // handle liquidity
        _handleLiquidity();
    }
}
