// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BNBPartyModifiers.sol";

abstract contract BNBPartyManageable is BNBPartyModifiers {
    function setNonfungiblePositionManager(
        INonfungiblePositionManager _BNBPositionManager,
        INonfungiblePositionManager _positionManager
    ) external onlyOwner {
        if (_BNBPositionManager == BNBPositionManager && _positionManager == positionManager) {
            revert PositionManagerAlreadySet();
        }
        positionManager = _positionManager;
        BNBPositionManager = _BNBPositionManager;
    }

    function setSwapRouter(ISwapRouter _swapRouter) external onlyOwner {
        if (_swapRouter == swapRouter) {
            revert SwapRouterAlreadySet();
        }
        swapRouter = _swapRouter;
    }

    /// @notice Withdraws the fee from token creation
    function withdrawFee() external onlyOwner {
        if (address(this).balance == 0) {
            revert ZeroAmount();
        }
        payable(msg.sender).transfer(address(this).balance);
        emit TransferOutBNB(msg.sender, address(this).balance);
    }

    /// @notice Withdraws the LP fee from the BNB Party
    function withdrawPartyLPFee(
        address[] calldata liquidityPools
    ) external onlyOwner {
        _withdrawLPFees(liquidityPools, BNBPositionManager);
    }

    /// @notice Withdraws the LP fee from the Pancakeswap V3
    function withdrawLPFee(address[] calldata liquidityPools) external onlyOwner {
        _withdrawLPFees(liquidityPools, positionManager);
    }

    /// @notice Withdraws the LP fee
    function _withdrawLPFees(
        address[] calldata liquidityPools,
        INonfungiblePositionManager manager
    ) internal {
        if (liquidityPools.length == 0) {
            revert ZeroLength();
        }
        for (uint256 i = 0; i < liquidityPools.length; ++i) {
            _collectFee(liquidityPools[i], manager);
        }
    }

    function _collectFee(
        address liquidityPool,
        INonfungiblePositionManager manager
    ) internal notZeroAddress(liquidityPool) {
        manager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: lpToTokenId[liquidityPool],
                recipient: msg.sender,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
    }
}
