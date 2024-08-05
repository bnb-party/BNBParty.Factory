import { expect } from "chai"
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { IUniswapV3Pool, MockContract } from "../typechain-types"
import {
    FeeAmount,
    getDataHexString,
    bnbPartyFactory,
    v3PartyFactory,
    BNBPositionManager,
    swapRouter,
    weth9,
    deployContracts,
} from "./helper"

describe("Withdraw fees", function () {
    let MEME: string
    let tokenId: string
    let position: any
    const amountIn = ethers.parseUnits("1", 18)
    let lpAddress: string
    let signers: SignerWithAddress[]
    const partyTarget = ethers.parseEther("90")
    const tokenCreationFee = ethers.parseUnits("1", 16)
    const name = "Party"
    const symbol = "Token"
    const BNBToTarget: bigint = partyTarget + ethers.parseEther("1")

    beforeEach(async () => {
        signers = await ethers.getSigners()
        await deployContracts()
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        tokenId = (await BNBPositionManager.totalSupply()).toString()
        position = await BNBPositionManager.positions(tokenId)
        MEME = position.token1 == (await weth9.getAddress()) ? position.token0 : position.token1
        lpAddress = await v3PartyFactory.getPool(MEME, await weth9.getAddress(), FeeAmount.HIGH)
    })

    it("should withdraw token creation fee", async () => {
        await deployContracts()
        const numbersOfParties = 5n
        for (let i = 0; i < numbersOfParties; ++i) {
            await bnbPartyFactory.connect(signers[1]).createParty(name, symbol, { value: tokenCreationFee })
        }
        const balanceBefore = await ethers.provider.getBalance(await signers[0].getAddress())
        const tx: any = await bnbPartyFactory.withdrawFee()
        const txReceipt = await tx.wait()
        const gasCost = ethers.toBigInt(txReceipt.gasUsed) * ethers.toBigInt(tx.gasPrice)
        const balanceAfter = await ethers.provider.getBalance(await signers[0].getAddress())
        expect(balanceAfter).to.be.equal(balanceBefore - gasCost + tokenCreationFee * numbersOfParties)
    })

    it("should withdraw party fee", async () => {
        await bnbPartyFactory.connect(signers[1]).createParty(name, symbol, { value: tokenCreationFee })
        tokenId = (await BNBPositionManager.totalSupply()).toString()
        position = await BNBPositionManager.positions(tokenId)
        MEME = position.token1 == (await weth9.getAddress()) ? position.token0 : position.token1
        await bnbPartyFactory.connect(signers[1]).joinParty(MEME, 0, { value: ethers.parseEther("10") })
        position = await BNBPositionManager.positions(tokenId)
        // 1% bnb party fee 10 ether = 0.1 ether
        const expectedFee = ethers.parseEther("0.1")
        const balanceBefore = await weth9.balanceOf(await signers[0].getAddress())
        const partyLP = await v3PartyFactory.getPool(await weth9.getAddress(), MEME, FeeAmount.HIGH)
        await bnbPartyFactory.withdrawPartyLPFee([partyLP])
        const balanceAfter = await weth9.balanceOf(await signers[0].getAddress())
        expect(balanceAfter).to.be.equal(balanceBefore + expectedFee - 1n)
    })

    it("should revert LPNotAtParty", async () => {
        const mockContract = await ethers.getContractFactory("MockContract")
        const mock = await mockContract.deploy()
        await bnbPartyFactory.connect(signers[1]).joinParty(MEME, 0, { value: BNBToTarget })
        await expect(mock.callHandleSwap(await bnbPartyFactory.getAddress())).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "LPNotAtParty"
        )
    })

    it("calculateFees should return zero if no swaps", async () => {
        const lpPool = (await ethers.getContractAt("UniswapV3Pool", lpAddress)) as any as IUniswapV3Pool
        const liquidity = await lpPool.liquidity()
        const feeGrowthGlobalX128 = await lpPool.feeGrowthGlobal1X128()
        const fees = await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobalX128)
        expect(fees).to.be.equal(0)
    })

    it("calculateFees should return fee from swap", async () => {
        await bnbPartyFactory.joinParty(MEME, 0, { value: amountIn })
        const lpPool = (await ethers.getContractAt("UniswapV3Pool", lpAddress)) as any as IUniswapV3Pool
        const liquidity = await lpPool.liquidity()
        const feeGrowthGlobalX128 = await lpPool.feeGrowthGlobal0X128()
        expect(await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobalX128)).to.be.equal(amountIn / 100n - 1n) // 1 % fee
    })

    it("calculateFees should return fee from 5 swaps", async () => {
        for (let i = 0; i < 5; i++) {
            await bnbPartyFactory.joinParty(MEME, 0, { value: amountIn })
        }
        const lpPool = (await ethers.getContractAt("UniswapV3Pool", lpAddress)) as any as IUniswapV3Pool
        const liquidity = await lpPool.liquidity()
        const feeGrowthGlobalX128 = await lpPool.feeGrowthGlobal0X128()
        expect(await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobalX128)).to.be.equal(amountIn / 20n - 1n) // 1 % fee
    })

    it("isToken0WBNB should return false if token0 is not WBNB", async () => {
        expect(await bnbPartyFactory.isToken0WBNB(lpAddress)).to.be.false
    })

    it("isToken0WBNB should revert if set zero address", async () => {
        await expect(bnbPartyFactory.isToken0WBNB(ethers.ZeroAddress)).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "ZeroAddress"
        )
    })

    it("should deacrease fee after withdraw", async () => {
        for (let i = 0; i < 5; i++) {
            await bnbPartyFactory.joinParty(MEME, 0, { value: amountIn })
        }
        const lpPool = (await ethers.getContractAt("UniswapV3Pool", lpAddress)) as any as IUniswapV3Pool
        await bnbPartyFactory.withdrawPartyLPFee([lpAddress])
        let liquidity = await lpPool.liquidity()
        let feeGrowthGlobalX128 =
            position.token1 == (await weth9.getAddress())
                ? await lpPool.feeGrowthGlobal1X128()
                : await lpPool.feeGrowthGlobal0X128()
        const collectedFee = await bnbPartyFactory.getFeeGrowthInsideLastX128(lpAddress)
        expect(
            await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobalX128 - collectedFee.feeGrowthInside0LastX128)
        ).to.be.equal(0)
    })

    it("should revert zero lenght array", async () => {
        await expect(bnbPartyFactory.withdrawLPFee([])).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroLength")
    })
})
