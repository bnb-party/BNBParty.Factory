import { expect } from "chai"
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { ERC20 } from "../typechain-types"
import {
    FeeAmount,
    getDataHexString,
    bnbPartyFactory,
    v3PartyFactory,
    BNBPositionManager,
    BNBSwapRouter,
    weth9,
    deployContracts,
} from "./helper"

describe("Smart Router", function () {
    let signers: SignerWithAddress[]
    const tokenCreationFee = ethers.parseUnits("1", 16)
    const name = "Party"
    const symbol = "Token"
    let tokenId: string
    let deadline: number
    let position: any
    let MEME: string
    let lpAddress: string
    let MEMEToken: ERC20

    before(async () => {
        signers = await ethers.getSigners()
        await deployContracts()
        // Create a party
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        tokenId = (await BNBPositionManager.totalSupply()).toString()
        deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now
        position = await BNBPositionManager.positions(tokenId)
        MEME = position.token1 == (await weth9.getAddress()) ? position.token0 : position.token1
        lpAddress = await v3PartyFactory.getPool(await weth9.getAddress(), MEME, FeeAmount.HIGH)
        MEMEToken = await ethers.getContractAt("ERC20", MEME)
        await MEMEToken.approve(await bnbPartyFactory.getAddress(), ethers.parseEther("100"))
        await MEMEToken.approve(await BNBSwapRouter.getAddress(), ethers.parseEther("100"))
    })

    it("should increase wbnb on party lp after join party", async () => {
        const amountIn = ethers.parseUnits("5", 17)
        const lpBalanceBefore = await weth9.balanceOf(lpAddress)
        await bnbPartyFactory.joinParty(MEME, 0, { value: amountIn })
        const lpBalanceAfter = await weth9.balanceOf(lpAddress)
        expect(lpBalanceAfter).to.be.equal(lpBalanceBefore + amountIn)
    })

    it("user should receive meme token after join party", async () => {
        const amountIn = ethers.parseUnits("5", 17)

        const balanceBefore = await MEMEToken.balanceOf(await signers[0].getAddress())
        await bnbPartyFactory.joinParty(MEME, 0, { value: amountIn })
        const balanceAfter = await MEMEToken.balanceOf(await signers[0].getAddress())
        expect(balanceAfter).to.be.gt(balanceBefore)
    })

    it("user should receive bnb after leave party", async () => {
        const amountIn = ethers.parseUnits("50", 18)
        const bnbBalanceBefore = await ethers.provider.getBalance(await signers[0].getAddress())
        await bnbPartyFactory.leaveParty(MEME, amountIn, 0)
        const bnbBalanceAfter = await ethers.provider.getBalance(await signers[0].getAddress())
        expect(bnbBalanceAfter).to.be.gt(bnbBalanceBefore)
    })

    it("swap router should send all bnb balance after leave party", async () => {
        const amountIn = ethers.parseUnits("1", 16)
        await bnbPartyFactory.leaveParty(MEME, amountIn, 0)
        const bnbBalance = await ethers.provider.getBalance(await BNBSwapRouter.getAddress())
        expect(bnbBalance).to.be.equal(0)
    })

    it("should deacrease wbnb on party lp after leave party", async () => {
        const amountIn = ethers.parseUnits("1", 16)

        const lpBalanceBefore = await weth9.balanceOf(lpAddress)
        await bnbPartyFactory.leaveParty(MEME, amountIn, 0)
        const lpBalanceAfter = await weth9.balanceOf(lpAddress)

        expect(lpBalanceBefore).to.be.gt(lpBalanceAfter)
    })

    it("BNB -> WBNB -> MEME exactInput call", async () => {
        const amountIn = ethers.parseUnits("1", 18)
        const path = getDataHexString(await weth9.getAddress(), MEME)

        const params = {
            path: path,
            recipient: await signers[0].getAddress(),
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: "0",
        }

        const balanceBefore = await MEMEToken.balanceOf(await signers[0].getAddress())
        await expect(await BNBSwapRouter.exactInput(params, { value: amountIn })).to.emit(weth9, "Deposit")
        const balanceAfter = await MEMEToken.balanceOf(await signers[0].getAddress())

        expect(balanceAfter).to.be.gt(balanceBefore)
    })

    it("MEME -> WBNB -> BNB multicall", async function () {
        const amountIn = ethers.parseUnits("1", 17)
        const MEME = position.token0
        const path = getDataHexString(MEME, await weth9.getAddress())

        const params = {
            path: path,
            recipient: ethers.ZeroAddress,
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: "0",
        }

        const exactInputData = BNBSwapRouter.interface.encodeFunctionData("exactInput", [params])
        // Encode the unwrapWETH9 call to convert WETH to ETH
        const unwrapWETH9Data = BNBSwapRouter.interface.encodeFunctionData("unwrapWETH9", [
            "0",
            await signers[1].getAddress(),
        ])
        const balanceBefore = await ethers.provider.getBalance(await signers[1].getAddress())
        await expect(await BNBSwapRouter.multicall([exactInputData, unwrapWETH9Data])).to.emit(weth9, "Withdrawal")
        const balanceAfter = await ethers.provider.getBalance(await signers[1].getAddress())
        expect(balanceAfter).to.be.gt(balanceBefore)
    })

    it("WBNB -> MEME exactInput call", async () => {
        const amountIn = ethers.parseUnits("1", 17)
        const amountOutMinimum = 0 // For testing, accept any amount out
        const path = getDataHexString(await weth9.getAddress(), MEME)

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now
        await weth9.deposit({ value: amountIn })
        await weth9.approve(await BNBSwapRouter.getAddress(), amountIn)

        const params = {
            path: path,
            recipient: await signers[0].getAddress(),
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
        }

        const balanceBefore = await MEMEToken.balanceOf(await signers[0].getAddress())
        await BNBSwapRouter.exactInput(params)
        const balanceAfter = await MEMEToken.balanceOf(await signers[0].getAddress())

        expect(balanceAfter).to.be.gt(balanceBefore)
    })

    it("execute auto-swap", async () => {
        const amountIn = ethers.parseUnits("1", 17)
        const tx = await bnbPartyFactory.createParty(name, symbol, { value: amountIn })
        await tx.wait()
        const events = await bnbPartyFactory.queryFilter(bnbPartyFactory.filters["StartParty(address,address,address)"])
        const tokenAddress = events[events.length - 1].args.tokenAddress
        const lpAddress = await v3PartyFactory.getPool(await weth9.getAddress(), tokenAddress, FeeAmount.HIGH)
        // check liquidity pool balance
        const liquidityPoolBalance = await weth9.balanceOf(lpAddress)
        expect(liquidityPoolBalance).to.be.equal(amountIn - tokenCreationFee)
    })

    it("should increase user tokens with excess party fee", async () => {
        const amountIn = ethers.parseUnits("1", 17)
        const tx = await bnbPartyFactory.createParty(name, symbol, { value: amountIn })
        await tx.wait()
        const events = await bnbPartyFactory.queryFilter(bnbPartyFactory.filters["StartParty(address,address,address)"])
        const tokenAddress = events[events.length - 1].args.tokenAddress
        const token = await ethers.getContractAt("ERC20Token", tokenAddress)

        const balance = await token.balanceOf(await signers[0].getAddress())
        expect(balance).to.be.gt(0)
    })

    it("should revert tokenOut zero address on join party", async () => {
        await expect(
            bnbPartyFactory.joinParty(ethers.ZeroAddress, 0, { value: ethers.parseUnits("1", 17) })
        ).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroAddress")
    })

    it("should revert zero msg.value on join party", async () => {
        await expect(bnbPartyFactory.joinParty(MEME, 0)).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroAmount")
    })

    it('should revert if "amountIn" is zero on leave party', async () => {
        await expect(bnbPartyFactory.leaveParty(MEME, 0, 0)).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "ZeroAmount"
        )
    })

    it("should revert if tokenOut zero address on leave party", async () => {
        await expect(
            bnbPartyFactory.leaveParty(ethers.ZeroAddress, ethers.parseUnits("1", 16), 0)
        ).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroAddress")
    })

    describe("Classic Swap Router", () => {
        const partyTarget = ethers.parseEther("90")
        const BNBToTarget: bigint = partyTarget + ethers.parseEther("1")

        before(async () => {
            // target reached
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
        })

        it("should swap BNB to MEME with classic swap router", async () => {
            const user = signers[3]
            const amountIn = ethers.parseUnits("1", 17)
            const token = await ethers.getContractAt("ERC20", MEME)
            const balanceBefore = await token.balanceOf(user.address)
            await bnbPartyFactory.connect(user).joinParty(MEME, 0, { value: amountIn })
            const balanceAfter = await token.balanceOf(user.address)
            expect(balanceAfter).to.be.gt(balanceBefore)
        })

        it("should swap MEME to BNB with classic swap router", async () => {
            const amountIn = ethers.parseUnits("1", 17)
            const balanceBefore = await ethers.provider.getBalance(await signers[0].getAddress())
            const tx = await bnbPartyFactory.leaveParty(MEME, amountIn, 0)
            const txReceipt = (await tx.wait()) as any
            const gasCost = ethers.toBigInt(txReceipt.gasUsed) * ethers.toBigInt(tx.gasPrice)
            const balanceAfter = await ethers.provider.getBalance(await signers[0].getAddress())
            expect(balanceAfter).to.be.gt(balanceBefore - gasCost)
        })
    })
})
