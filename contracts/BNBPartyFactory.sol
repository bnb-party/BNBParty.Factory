// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./token/ERC20Token.sol";
import "./BNBPartyInternal.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BNBPartyFactory is BNBPartyInternal, ReentrancyGuard {
    constructor(
        uint256 _partyTarget,
        uint256 _createTokenFee,
        uint24 _partyLpFee,
        uint24 _lpFee,
        uint256 _initialTokenAmount,
        uint160 _sqrtPriceX96,
        IWBNB _WBNB,
        uint256 _bonusTargetReach,
        uint256 _bonusPartyCreator,
        int24 _tickLower,
        int24 _tickUpper
    )
        BNBPartyState(
            _partyTarget,
            _createTokenFee,
            _partyLpFee,
            _lpFee,
            _initialTokenAmount,
            _sqrtPriceX96,
            _WBNB,
            _bonusTargetReach,
            _bonusPartyCreator,
            _tickLower,
            _tickUpper
        )
    {}

    function createParty(
        string calldata name,
        string calldata symbol
    ) external payable override nonReentrant returns (IERC20 newToken) {
        // create new token
        newToken = new ERC20Token(name, symbol, initialTokenAmount);
        // create First Liquidity Pool
        address liquidityPool = _createFLP(address(newToken));
        emit StartParty(address(newToken), msg.sender, liquidityPool);
    }

    function handleSwap(address recipient) external override nonReentrant {
        require(isParty[msg.sender], "LP is not at the party");

        uint256 WBNBBalance = WBNB.balanceOf(msg.sender);
        if (WBNBBalance < partyTarget) return;

        // uwrap return amount WBNB and send to recipient
        _unwrapAndSendBNB(recipient);

        // handle liquidity
        _handleLiquidity();
    }
}
