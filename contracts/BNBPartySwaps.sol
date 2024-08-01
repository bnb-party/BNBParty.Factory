// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyView.sol";

/// @title BNBPartySwaps
/// @notice This abstract contract provides internal functions for swapping tokens and managing BNB in the BNB Party system.
abstract contract BNBPartySwaps is BNBPartyView {
    /// @notice Unwraps WBNB and sends BNB to the recipient. Awards bonus if recipient is the creator.
    /// @param recipient Address receiving the unwrapped BNB
    /// @param unwrapAmount Amount of WBNB to unwrap
    /// @dev Transfers bonus amounts based on whether the recipient is the creator or not
    function _unwrapAndSendBNB(address recipient, uint256 unwrapAmount) internal {
        address creator = lpToCreator[msg.sender];
        WBNB.withdraw(unwrapAmount); // Unwrap WBNB to BNB
        if (recipient == creator) {
            _transferBNB(recipient, party.bonusTargetReach + party.bonusPartyCreator); // Send total bonus to creator
        } else {
            _transferBNB(recipient, party.bonusTargetReach); // Send bonus to recipient
            _transferBNB(creator, party.bonusPartyCreator); // Send bonus to creator
        }
    }

    /// @notice Transfers BNB to the specified recipient
    /// @param recipient Address receiving the BNB
    /// @param amount Amount of BNB to transfer
    /// @dev Uses call to send BNB and reverts if the transfer fails
    function _transferBNB(address recipient, uint256 amount) private {
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert BonusAmountTransferFailed();
        }
        emit TransferOutBNB(recipient, amount);
    }

    /// @notice Executes a swap from WBNB to another token
    /// @param tokenOut Address of the token to swap to
    /// @dev Calculates amount to swap based on msg.value and executes the swap
    function _executeSwap(address tokenOut) internal {
        uint256 amountIn = msg.value - party.createTokenFee;
        _executeSwap(address(WBNB), tokenOut, msg.sender, 0, amountIn);
    }

    /// @notice Executes a swap between two tokens using the swap router
    /// @param tokenIn Address of the token to swap from
    /// @param tokenOut Address of the token to swap to
    /// @param recipient Address receiving the output token
    /// @param amountOutMinimum Minimum amount of output token to receive
    /// @param amountIn Amount of input token to swap
    /// @dev Uses the swap router to perform the swap and handle ether value if provided
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
        uint256 value = msg.value > 0 ? amountIn : 0; // Set value if msg.value is greater than zero
        swapRouter.exactInput{value: value}(params); // Executes the swap
    }

    /// @notice Determines the token pair and price direction based on the input token
    /// @param _token Address of the input token
    /// @return token0 Address of the first token in the pair
    /// @return token1 Address of the second token in the pair
    /// @return sqrtPriceX96 The sqrt price of the token pair
    function _getTokenPairAndPrice(
        address _token
    ) internal view returns (address token0, address token1, uint160 sqrtPriceX96) {
        if (_token < address(WBNB)) {
            return (_token, address(WBNB), party.sqrtPriceX96);
        } else {
            return (address(WBNB), _token, _reverseSqrtPrice(party.sqrtPriceX96));
        }
    }

    /// @notice Calculates the reverse square root price
    /// @param sqrtPriceX96 The original square root price
    /// @return reverseSqrtPriceX96 The reversed square root price
    /// @dev Used to determine the price direction for swaps
    function _reverseSqrtPrice(uint160 sqrtPriceX96) internal pure returns (uint160 reverseSqrtPriceX96) {
        reverseSqrtPriceX96 = uint160((1 << 192) / sqrtPriceX96);
    }
}
