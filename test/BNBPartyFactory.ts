import { expect } from "chai"
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { keccak256 } from "ethers"
import { bytecode } from "../artifacts/@bnb-party/v3-core/contracts/UniswapV3Pool.sol/UniswapV3Pool.json"
import {
    FeeAmount,
    bnbPartyFactory,
    v3Factory,
    v3PartyFactory,
    positionManager,
    BNBPositionManager,
    BNBSwapRouter,
    weth9,
    deployContracts,
} from "./helper"

const POOL_BYTECODE_HASH = keccak256(bytecode)
//console.log(POOL_BYTECODE_HASH)

describe("BNBPartyFactory", function () {
    let signers: SignerWithAddress[]
    const partyTarget = ethers.parseEther("90")
    const tokenCreationFee = ethers.parseUnits("1", 16)
    const returnFeeAmount = ethers.parseUnits("5", 17)
    const bonusFee = ethers.parseUnits("1", 16)
    const targetReachFee = ethers.parseUnits("1", 17)
    const initialTokenAmount = "1000000000000000000000000000"
    const name = "Party"
    const symbol = "Token"
    const sqrtPriceX96 = "7922427122162318518285487"
    const BNBToTarget: bigint = partyTarget + ethers.parseEther("1")

    before(async () => {
        signers = await ethers.getSigners()
        await deployContracts()
    })

    it("should deploy BNBPartyFactory", async function () {
        expect((await bnbPartyFactory.party()).partyTarget).to.equal(partyTarget)
        expect((await bnbPartyFactory.party()).initialTokenAmount).to.equal(initialTokenAmount)
        expect((await bnbPartyFactory.party()).sqrtPriceX96).to.equal(sqrtPriceX96)
        expect(await bnbPartyFactory.WBNB()).to.equal(await weth9.getAddress())
        expect((await bnbPartyFactory.party()).bonusTargetReach).to.equal(returnFeeAmount)
        expect((await bnbPartyFactory.party()).bonusPartyCreator).to.equal(bonusFee)
        expect((await bnbPartyFactory.party()).lpFee).to.equal(FeeAmount.HIGH)
        expect((await bnbPartyFactory.party()).partyLpFee).to.equal(FeeAmount.HIGH)
        expect((await bnbPartyFactory.party()).createTokenFee).to.equal(tokenCreationFee)
        expect((await bnbPartyFactory.party()).tickUpper).to.equal("184200")
        expect((await bnbPartyFactory.party()).tickLower).to.equal("-203800")
    })

    it("should create party LP", async function () {
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        expect(await BNBPositionManager.totalSupply()).to.equal(1)
    })

    it("should create a token with a name ending with ' Party'", async function () {
        const tx = await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        await tx.wait()
        const events = await bnbPartyFactory.queryFilter(bnbPartyFactory.filters["StartParty(address,address,address)"])
        const tokenAddress = events[events.length - 1].args.tokenAddress
        const token = await ethers.getContractAt("ERC20Token", tokenAddress)
        expect(await token.name()).to.equal(name + " Party")
        expect(await token.symbol()).to.equal(symbol)
    })

    it("bnb-party is owner of the party LP", async () => {
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        const tokenId = (await BNBPositionManager.totalSupply()) - 1n
        const owner = await BNBPositionManager.ownerOf(tokenId)
        expect(owner).to.equal(await bnbPartyFactory.getAddress())
    })

    it("should pay fee for token and lp creation", async function () {
        const balanceBefore = await ethers.provider.getBalance(await bnbPartyFactory.getAddress())
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        const balanceAfter = await ethers.provider.getBalance(await bnbPartyFactory.getAddress())
        expect(balanceAfter).to.be.equal(balanceBefore + tokenCreationFee)
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

    it("should revert if swap router is not set", async function () {
        const amountIn = ethers.parseUnits("1", 18)
        await bnbPartyFactory.setBNBPartySwapRouter(ethers.ZeroAddress)
        await expect(bnbPartyFactory.createParty(name, symbol, { value: amountIn })).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "ZeroAddress"
        )
        await bnbPartyFactory.setBNBPartySwapRouter(await BNBSwapRouter.getAddress())
    })

    describe("Second Liquidity Pool", function () {
        let MEME: string
        let tokenId: string
        let position: any

        beforeEach(async () => {
            await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
            tokenId = ((await BNBPositionManager.totalSupply()) - 1n).toString()
            position = await BNBPositionManager.positions(tokenId)
            MEME = position.token1 == (await weth9.getAddress()) ? position.token0 : position.token1
        })

        it("should create second liquidity pool", async () => {
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
            expect(await positionManager.totalSupply()).to.equal(1)
        })

        it("bnb-party is owner of the second LP", async () => {
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
            const tokenId = (await positionManager.totalSupply()) - 1n
            expect(await positionManager.ownerOf(tokenId)).to.equal(await bnbPartyFactory.getAddress())
        })

        it("should send bonus to party creator", async () => {
            const balanceBefore = await ethers.provider.getBalance(await signers[0].getAddress())
            await bnbPartyFactory.connect(signers[1]).joinParty(MEME, 0, { value: BNBToTarget })
            const balanceAfter = await ethers.provider.getBalance(await signers[0].getAddress())
            expect(balanceAfter).to.be.equal(balanceBefore + bonusFee)
        })

        it("should send MEME to new LP", async () => {
            const token = await ethers.getContractAt("ERC20Token", MEME)
            const oldLPPool = await v3PartyFactory.getPool(await weth9.getAddress(), MEME, FeeAmount.HIGH)
            const oldBalance = await token.balanceOf(oldLPPool)
            const rest = await token.balanceOf(await bnbPartyFactory.getAddress())
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
            const newLPPool = await v3Factory.getPool(await weth9.getAddress(), MEME, FeeAmount.HIGH)
            const newBalance = await token.balanceOf(newLPPool)
            const userBalance = await token.balanceOf(await signers[0].getAddress())
            const bnbpartyBalance = await token.balanceOf(await bnbPartyFactory.getAddress())
            expect(newBalance).to.be.equal(oldBalance + rest - userBalance - bnbpartyBalance - 2n)
        })

        it("should send WBNB to new LP", async () => {
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
            const lpAddress = await v3Factory.getPool(await weth9.getAddress(), MEME, FeeAmount.HIGH)
            const balance = await weth9.balanceOf(lpAddress)
            const percentFee = ethers.parseEther("0.91")
            expect(balance).to.be.equal(BNBToTarget - returnFeeAmount - bonusFee - targetReachFee - percentFee - 2n)
        })
    })
})
