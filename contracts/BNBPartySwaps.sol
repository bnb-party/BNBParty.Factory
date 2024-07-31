// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyView.sol";

abstract contract BNBPartySwaps is BNBPartyView {
    function _unwrapAndSendBNB(address recipient, uint256 unwrapAmount) internal {
        address creator = lpToCreator[msg.sender];
        WBNB.withdraw(unwrapAmount);
        if (recipient == creator) {
            _transferBNB(recipient, party.bonusTargetReach + party.bonusPartyCreator);
        } else {
            _transferBNB(recipient, party.bonusTargetReach);
            _transferBNB(creator, party.bonusPartyCreator);
        }
    }

    function _transferBNB(address recipient, uint256 amount) private {
        // Use call to send BNB
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert BonusAmountTransferFailed();
        }
        emit TransferOutBNB(recipient, amount);
    }

    function _executeSwap(address tokenOut) internal {
        uint256 amountIn = msg.value - party.createTokenFee;
        _executeSwap(address(WBNB), tokenOut, msg.sender, 0, amountIn);
    }

    function _executeSwap(
        address tokenIn,
        address tokenOut,
        address recipient,
        uint256 amountOutMinimum,
        uint256 amountIn
    ) internal notZeroAddress(address(swapRouter)) {
        ISwapRouter.ExactInputParams memory params = ISwapRouter
            .ExactInputParams({
                path: abi.encodePacked(tokenIn, party.partyLpFee, tokenOut),
                recipient: recipient,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum
            });
        uint256 value = msg.value > 0 ? amountIn : 0;
        swapRouter.exactInput{value: value}(params);
    }

    function _getTokenPairAndPrice(
        address _token
    ) internal view returns (address, address, uint160) {
        if (_token < address(WBNB)) {
            return (_token, address(WBNB), party.sqrtPriceX96);
        }
        else {
            return (address(WBNB), _token, _reverseSqrtPrice(party.sqrtPriceX96));
        }
    }

    function _reverseSqrtPrice(uint160 sqrtPriceX96) internal pure returns (uint160 reverseSqrtPriceX96) {
        reverseSqrtPriceX96 = uint160((1 << 192) / sqrtPriceX96);
    }
}
