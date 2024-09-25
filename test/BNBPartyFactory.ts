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
    setupTokenAndPool,
    wbnb,
    deployContracts,
} from "./helper"

const POOL_BYTECODE_HASH = keccak256(bytecode)
//console.log(POOL_BYTECODE_HASH)

describe("BNBPartyFactory", function () {
    let signers: SignerWithAddress[]
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
        signers = await ethers.getSigners()
        await deployContracts(partyTarget)
    })

    it("should deploy BNBPartyFactory", async function () {
        expect((await bnbPartyFactory.party()).partyTarget).to.equal(partyTarget)
        expect((await bnbPartyFactory.party()).initialTokenAmount).to.equal(initialTokenAmount)
        expect((await bnbPartyFactory.party()).sqrtPriceX96).to.equal(sqrtPriceX96)
        expect(await bnbPartyFactory.WBNB()).to.equal(await wbnb.getAddress())
        expect((await bnbPartyFactory.party()).bonusTargetReach).to.equal(returnFeeAmount)
        expect((await bnbPartyFactory.party()).bonusPartyCreator).to.equal(bonusFee)
        expect((await bnbPartyFactory.party()).lpFee).to.equal(FeeAmount.HIGH)
        expect((await bnbPartyFactory.party()).partyLpFee).to.equal(FeeAmount.HIGH)
        expect((await bnbPartyFactory.party()).createTokenFee).to.equal(tokenCreationFee)
        expect((await bnbPartyFactory.party()).partyTicks.tickUpper).to.equal("214200")
        expect((await bnbPartyFactory.party()).partyTicks.tickLower).to.equal("-195600")
    })

    it("should create party LP", async function () {
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        expect(await BNBPositionManager.totalSupply()).to.equal(1)
    })

    it("should create a pool if a pancakeswap pool has already been created before target reached", async function () {
        // create party LP
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        // buy some party tokens
        const tokenId = (await BNBPositionManager.totalSupply()).toString()
        const position = await BNBPositionManager.positions(tokenId)
        const MEME = position.token1 == (await wbnb.getAddress()) ? position.token0 : position.token1
        await bnbPartyFactory.joinParty(MEME, 0, { value: ethers.parseEther("5") })
        // create pancakeswap pool
        const token = await ethers.getContractAt("ERC20Token", MEME)
        const sqrt = "8602843886007566775194646947"

        await wbnb.deposit({ value: ethers.parseEther("13") }) // wrap 13 BNB
        await wbnb.approve(await positionManager.getAddress(), ethers.MaxUint256)
        await setupTokenAndPool(token, positionManager, sqrt, "1150000000000000000", "92529783317606807806")
        // target reached
        await expect(bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })).to.be.not.reverted
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

    it("should set pause", async function () {
        await bnbPartyFactory.pause()
        expect(await bnbPartyFactory.paused()).to.be.true
        await bnbPartyFactory.unpause()
    })

    it("should unpause", async function () {
        await bnbPartyFactory.pause()
        await bnbPartyFactory.unpause()
        expect(await bnbPartyFactory.paused()).to.be.false
    })

    describe("Second Liquidity Pool", function () {
        let MEME: string
        let tokenId: string
        let position: any

        beforeEach(async () => {
            await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
            tokenId = ((await BNBPositionManager.totalSupply()) - 1n).toString()
            position = await BNBPositionManager.positions(tokenId)
            MEME = position.token1 == (await wbnb.getAddress()) ? position.token0 : position.token1
        })

        it("should create second liquidity pool", async () => {
            const beforeTotalSupply = await positionManager.totalSupply()
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
            expect(await positionManager.totalSupply()).to.equal(beforeTotalSupply + 1n)
        })

        it("should have a MEME balance of 0 on BNBPartyFactory", async () => {
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
            const token = await ethers.getContractAt("ERC20Token", MEME)
            const balance = await token.balanceOf(await bnbPartyFactory.getAddress())
            expect(balance).to.be.equal(0)
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

        it("should send WBNB to new LP", async () => {
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
            const lpAddress = await v3Factory.getPool(await wbnb.getAddress(), MEME, FeeAmount.HIGH)
            const balance = await wbnb.balanceOf(lpAddress)
            const percentFee = ethers.parseEther("0.14") // target 13 + 1 BNB - 1% fee
            expect(balance).to.be.equal(BNBToTarget - returnFeeAmount - bonusFee - targetReachFee - percentFee - 1n)
        })

        it("should send MEME to new LP", async () => {
            const token = await ethers.getContractAt("ERC20Token", MEME)
            const oldLPPool = await v3PartyFactory.getPool(await wbnb.getAddress(), MEME, FeeAmount.HIGH)
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
            const oldPoolBalance = await token.balanceOf(oldLPPool)
            const newLPPool = await v3Factory.getPool(await wbnb.getAddress(), MEME, FeeAmount.HIGH)
            const newBalance = await token.balanceOf(newLPPool)
            const userBalance = await token.balanceOf(await signers[0].getAddress())
            const totalSupply = await token.totalSupply()
            expect(newBalance).to.be.equal(totalSupply - userBalance - oldPoolBalance)
        })
    })
})
