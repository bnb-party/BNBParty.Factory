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
    /// @dev Uses transfer to send BNB and reverts if the transfer fails
    function _transferBNB(address recipient, uint256 amount) private {
        emit TransferOutBNB(recipient, amount);
        payable(recipient).transfer(amount); // Transfer BNB to recipient
    }

    /// @notice Executes a swap from WBNB to another token
    /// @param tokenOut Address of the token to swap to
    /// @dev Calculates amount to swap based on msg.value and executes the swap
    function _executeSwap(address tokenOut) internal {
        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: abi.encodePacked(address(WBNB), party.partyLpFee, tokenOut),
            recipient: msg.sender,
            deadline: block.timestamp,
            amountIn: msg.value - party.createTokenFee,
            amountOutMinimum: 0
        });
        _executeSwap(BNBSwapRouter, params);
    }

    function _executeSwap(
        ISwapRouter router,
        ISwapRouter.ExactInputParams memory params
    ) internal notZeroAddress(address(router)) {
        uint256 value = msg.value > 0 ? params.amountIn : 0; // Set value if msg.value is greater than zero
        ISwapRouter(router).exactInput{value: value}(params); // Executes the swap
    }

    /// @notice Determines the token pair and price direction based on the input token
    /// @param _token Address of the input token
    /// @return token0 Address of the first token in the pair
    /// @return token1 Address of the second token in the pair
    /// @return sqrtPriceX96 The sqrt price of the token pair
    /// @return ticks The ticks for the token pair
    function _getTokenPairAndPrice(
        address _token
    ) internal view returns (address token0, address token1, uint160 sqrtPriceX96, Ticks memory ticks) {
        if (_token < address(WBNB)) {
            return (_token, address(WBNB), party.sqrtPriceX96, party.partyTicksPos0);
        } else {
            return (address(WBNB), _token, _reverseSqrtPrice(party.sqrtPriceX96), party.partyTicksPos1);
        }
    }

    /// @notice Calculates the reverse square root price
    /// @param sqrtPriceX96 The original square root price
    /// @return reverseSqrtPriceX96 The reversed square root price
    /// @dev Used to determine the price direction for swaps
    function _reverseSqrtPrice(uint160 sqrtPriceX96) internal pure returns (uint160 reverseSqrtPriceX96) {
        reverseSqrtPriceX96 = uint160((1 << 192) / sqrtPriceX96);
    }

    /// @notice Helper function to get the appropriate router and fee based on the token
    /// @param token The address of the token to determine the router and fee for
    /// @return router The address of the swap router
    /// @return fee The fee amount for the swap
    function _getRouterAndFee(address token) internal view returns (ISwapRouter router, uint24 fee) {
        if (isTokenOnPartyLP[token]) {
            router = BNBSwapRouter;
            fee = party.partyLpFee;
        } else {
            router = swapRouter;
            fee = party.lpFee;
        }
    }
}
