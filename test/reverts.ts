import { expect } from "chai"
import { ethers } from "hardhat"
import {
    bnbPartyFactory,
    v3Factory,
    positionManager,
    BNBPositionManager,
    BNBSwapRouter,
    swapRouter,
    wbnb,
    deployContracts,
    deployBNBPartyFactory,
} from "./helper"

describe("BNBPartyFactory reverts", function () {
    const partyTarget = ethers.parseEther("13") // 13 BNB target
    const tokenCreationFee = ethers.parseUnits("1", 16) // 0.01 BNB token creation fee
    const returnFeeAmount = ethers.parseUnits("5", 16) // 0.05 BNB return fee (bonusTargetReach)
    const bonusFee = ethers.parseUnits("1", 17) // 0.01 BNB bonus fee (bonusPartyCreator)
    const targetReachFee = ethers.parseUnits("8.5", 17) // 0.85 BNB target reach fee
    const initialTokenAmount = "1000000000000000000000000000"
    const name = "Party"
    const symbol = "Token"
    const sqrtPriceX96 = "1252685732681638336686364"
    const BNBToTarget: bigint = partyTarget + ethers.parseEther("1")

    before(async () => {
        await deployContracts(partyTarget)
    })

    it("should revert WBNB zero address", async function () {
        const sqrtAddress = "0x0000000000000000000000000000000000000001"
        await expect(
            deployBNBPartyFactory(
                partyTarget,
                tokenCreationFee,
                returnFeeAmount,
                bonusFee,
                targetReachFee,
                initialTokenAmount,
                sqrtPriceX96,
                ethers.ZeroAddress,
                sqrtAddress
            )
        ).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroAddress")
    })

    it("should revert sqrtPriceCalculator zero address", async function () {
        const WBNB = "0x0000000000000000000000000000000000000001"
        await expect(
            deployBNBPartyFactory(
                partyTarget,
                tokenCreationFee,
                returnFeeAmount,
                bonusFee,
                targetReachFee,
                initialTokenAmount,
                sqrtPriceX96,
                WBNB,
                ethers.ZeroAddress
            )
        ).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroAddress")
    })

    it("should revert zero target", async function () {
        await expect(
            deployBNBPartyFactory(
                0n,
                tokenCreationFee,
                returnFeeAmount,
                bonusFee,
                targetReachFee,
                initialTokenAmount,
                sqrtPriceX96,
                await wbnb.getAddress(),
                await v3Factory.getAddress()
            )
        ).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroAmount")
    })

    it("should revert zero initialTokenAmount", async function () {
        await expect(
            deployBNBPartyFactory(
                partyTarget,
                tokenCreationFee,
                returnFeeAmount,
                bonusFee,
                targetReachFee,
                "0",
                sqrtPriceX96,
                await wbnb.getAddress(),
                await v3Factory.getAddress()
            )
        ).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroAmount")
    })

    it("should revert zero sqrtPriceX96", async function () {
        await expect(
            deployBNBPartyFactory(
                partyTarget,
                tokenCreationFee,
                returnFeeAmount,
                bonusFee,
                targetReachFee,
                initialTokenAmount,
                "0",
                await wbnb.getAddress(),
                await v3Factory.getAddress()
            )
        ).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroAmount")
    })

    it("should revert if target is less than fees", async function () {
        await expect(
            deployBNBPartyFactory(
                bonusFee,
                tokenCreationFee,
                returnFeeAmount,
                bonusFee,
                targetReachFee,
                initialTokenAmount,
                sqrtPriceX96,
                await wbnb.getAddress(),
                await v3Factory.getAddress()
            )
        ).to.be.revertedWithCustomError(bnbPartyFactory, "BonusGreaterThanTarget")
    })

    it("should revert if not enough BNB is sent", async function () {
        await expect(
            bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee - 1n })
        ).to.be.revertedWithCustomError(bnbPartyFactory, "InsufficientBNB")
    })

    it("should revert to Create Party if position manager is not set", async function () {
        await bnbPartyFactory.setNonfungiblePositionManager(ethers.ZeroAddress, ethers.ZeroAddress)
        await expect(
            bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        ).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroAddress")
        await bnbPartyFactory.setNonfungiblePositionManager(
            await BNBPositionManager.getAddress(),
            await positionManager.getAddress()
        )
    })

    it("should revert setNonfungiblePositionManager if set same address", async function () {
        await expect(
            bnbPartyFactory.setNonfungiblePositionManager(
                await BNBPositionManager.getAddress(),
                await positionManager.getAddress()
            )
        ).to.be.revertedWithCustomError(bnbPartyFactory, "PositionManagerAlreadySet")
    })

    it("should revert if swap router is not set", async function () {
        const amountIn = ethers.parseUnits("1", 18)
        await bnbPartyFactory.setBNBPartySwapRouter(ethers.ZeroAddress)
        await expect(bnbPartyFactory.createParty(name, symbol, { value: amountIn })).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "ZeroAddress"
        )
        await bnbPartyFactory.setBNBPartySwapRouter(await BNBSwapRouter.getAddress())
    })

    it("should revert party creation if paused", async function () {
        await bnbPartyFactory.pause()
        await expect(
            bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        ).to.be.revertedWithCustomError(bnbPartyFactory, "EnforcedPause")
        await bnbPartyFactory.unpause()
    })

    it("should revert double swap router set", async function () {
        await expect(bnbPartyFactory.setSwapRouter(await swapRouter.getAddress())).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "AlreadySet"
        )
    })

    it("should revert if liquidity pool is zero address on withdrawPartyLPFee", async function () {
        await expect(bnbPartyFactory.withdrawPartyLPFee([ethers.ZeroAddress])).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "ZeroAddress"
        )
    })

    it("should revert if liquidity pool is zero address on withdrawLPFee", async function () {
        await expect(bnbPartyFactory.withdrawLPFee([ethers.ZeroAddress])).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "ZeroAddress"
        )
    })

    it("should revert double bnb party swap router set", async function () {
        await expect(
            bnbPartyFactory.setBNBPartySwapRouter(await BNBSwapRouter.getAddress())
        ).to.be.revertedWithCustomError(bnbPartyFactory, "AlreadySet")
    })

    it("should revert join party if paused", async function () {
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        await bnbPartyFactory.pause()
        const tokenId = await BNBPositionManager.totalSupply()
        const position = await BNBPositionManager.positions(tokenId)
        const MEME = position.token1 == (await wbnb.getAddress()) ? position.token0 : position.token1
        await expect(bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "EnforcedPause"
        )
        await bnbPartyFactory.unpause()
    })

    it("should revert leave party if paused", async function () {
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        const tokenId = await BNBPositionManager.totalSupply()
        const position = await BNBPositionManager.positions(tokenId)
        const MEME = position.token1 == (await wbnb.getAddress()) ? position.token0 : position.token1
        const MEMEToken = await ethers.getContractAt("ERC20Token", MEME)
        await MEMEToken.approve(await bnbPartyFactory.getAddress(), ethers.parseEther("1000000"))
        await bnbPartyFactory.joinParty(MEME, 0, { value: tokenCreationFee })
        await bnbPartyFactory.pause()
        await expect(bnbPartyFactory.leaveParty(MEME, tokenCreationFee, 0)).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "EnforcedPause"
        )
        await bnbPartyFactory.unpause()
    })

    it("isToken0WBNB should revert if set zero address", async () => {
        await expect(bnbPartyFactory.isToken0WBNB(ethers.ZeroAddress)).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "ZeroAddress"
        )
    })
})
