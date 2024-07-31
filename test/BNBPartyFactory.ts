import { expect } from "chai"
import { ethers } from "hardhat"
import { IWBNB } from "../typechain-types/contracts/interfaces/IWBNB"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { BNBPartyFactory } from "../typechain-types/contracts/BNBPartyFactory"
import { UniswapV3Factory } from "../typechain-types/@bnb-party/v3-core/contracts/UniswapV3Factory"
import { NonfungiblePositionManager } from "../typechain-types/@bnb-party/v3-periphery/contracts/NonfungiblePositionManager"
import { MockNonfungibleTokenPositionDescriptor } from "../typechain-types/contracts/mock/MockNonfungibleTokenPositionDescriptor"
import { SwapRouter } from "../typechain-types/@bnb-party/v3-periphery/contracts/SwapRouter"
import { keccak256 } from "ethers"
import WETH9Artifact from "./WETH9/WETH9.json"
import FactoryArtifact from "@bnb-party/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"
import { bytecode } from "../artifacts/@bnb-party/v3-core/contracts/UniswapV3Pool.sol/UniswapV3Pool.json"
import { FeeAmount } from "./helper"

const POOL_BYTECODE_HASH = keccak256(bytecode)
//console.log(POOL_BYTECODE_HASH)

describe("BNBPartyFactory", function () {
    let signers: SignerWithAddress[]
    let bnbPartyFactory: BNBPartyFactory
    let v3Factory: UniswapV3Factory
    let v3PartyFactory: UniswapV3Factory
    let positionManager: NonfungiblePositionManager
    let BNBPositionManager: NonfungiblePositionManager
    let tokenPositionDescriptor: MockNonfungibleTokenPositionDescriptor
    let BNBSwapRouter: SwapRouter
    let swapRouter: SwapRouter
    let weth9: IWBNB
    const partyTarget = ethers.parseEther("90")
    const tokenCreationFee = ethers.parseUnits("1", 16)
    const returnFeeAmount = ethers.parseUnits("5", 17)
    const bonusFee = ethers.parseUnits("1", 16)
    const targetReachFee = ethers.parseUnits("1", 17)
    const initialTokenAmount = "10000000000000000000000000"
    const name = "Party"
    const symbol = "Token"
    const sqrtPriceX96 = "25052911542910170730777872"
    const BNBToTarget: bigint = partyTarget + ethers.parseEther("1")

    async function deployContracts() {
        // Deploy WETH9
        const WETH9 = await ethers.getContractFactory(WETH9Artifact.abi, WETH9Artifact.bytecode)
        weth9 = (await WETH9.deploy()) as IWBNB
        // Deploy BNBPartyFactory
        const BNBPartyFactoryContract = await ethers.getContractFactory("BNBPartyFactory")
        bnbPartyFactory = (await BNBPartyFactoryContract.deploy(
            {
                partyTarget: partyTarget,
                createTokenFee: tokenCreationFee,
                partyLpFee: FeeAmount.HIGH,
                lpFee: FeeAmount.HIGH,
                initialTokenAmount: initialTokenAmount,
                sqrtPriceX96: sqrtPriceX96,
                bonusTargetReach: returnFeeAmount,
                bonusPartyCreator: bonusFee,
                targetReachFee: targetReachFee,
                tickLower: "-92200",
                tickUpper: "0",
            },
            await weth9.getAddress()
        )) as BNBPartyFactory

        // Deploy Uniswap V3 Factory
        const V3FactoryContract = await ethers.getContractFactory(FactoryArtifact.abi, FactoryArtifact.bytecode)
        v3Factory = (await V3FactoryContract.deploy(await bnbPartyFactory.getAddress())) as UniswapV3Factory

        v3PartyFactory = (await V3FactoryContract.deploy(await bnbPartyFactory.getAddress())) as UniswapV3Factory

        // Deploy Token Position Descriptor
        const TokenPositionDescriptor = await ethers.getContractFactory("MockNonfungibleTokenPositionDescriptor")
        tokenPositionDescriptor = (await TokenPositionDescriptor.deploy()) as MockNonfungibleTokenPositionDescriptor

        // Deploy Position Manager
        const PositionManagerContract = await ethers.getContractFactory("NonfungiblePositionManager")
        positionManager = (await PositionManagerContract.deploy(
            await v3Factory.getAddress(),
            await weth9.getAddress(),
            await tokenPositionDescriptor.getAddress()
        )) as NonfungiblePositionManager

        BNBPositionManager = (await PositionManagerContract.deploy(
            await v3PartyFactory.getAddress(),
            await weth9.getAddress(),
            await tokenPositionDescriptor.getAddress()
        )) as NonfungiblePositionManager

        // Deploy Swap Router
        const SwapRouterContract = await ethers.getContractFactory("SwapRouter")
        BNBSwapRouter = (await SwapRouterContract.deploy(
            await v3PartyFactory.getAddress(),
            await weth9.getAddress()
        )) as SwapRouter

        swapRouter = (await SwapRouterContract.deploy(
            await v3Factory.getAddress(),
            await weth9.getAddress()
        )) as SwapRouter

        // Set Position Manager in BNBPartyFactory
        await bnbPartyFactory.setNonfungiblePositionManager(
            await BNBPositionManager.getAddress(),
            await positionManager.getAddress()
        )
        // Set Swap Router in BNBPartyFactory
        await bnbPartyFactory.setSwapRouter(await BNBSwapRouter.getAddress())
    }

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
        expect((await bnbPartyFactory.party()).tickUpper).to.equal("0")
        expect((await bnbPartyFactory.party()).tickLower).to.equal("-92200")
    })

    it("should create party LP", async function () {
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        expect(await BNBPositionManager.totalSupply()).to.equal(1)
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
        await bnbPartyFactory.setSwapRouter(ethers.ZeroAddress)
        await expect(bnbPartyFactory.createParty(name, symbol, { value: amountIn })).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "ZeroAddress"
        )
        await bnbPartyFactory.setSwapRouter(await BNBSwapRouter.getAddress())
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
            expect(newBalance).to.be.equal(oldBalance + rest - userBalance - bnbpartyBalance - 1n)
        })

        it("should send WBNB to new LP", async () => {
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
            const lpAddress = await v3Factory.getPool(await weth9.getAddress(), MEME, FeeAmount.HIGH)
            const balance = await weth9.balanceOf(lpAddress)
            const percentFee = ethers.parseEther("0.91")
            expect(balance).to.be.equal(BNBToTarget - returnFeeAmount - bonusFee - targetReachFee - percentFee - 1n)
        })
    })
})
