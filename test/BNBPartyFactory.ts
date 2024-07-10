import { BNBPartyFactory } from "../typechain-types/contracts/BNBPartyFactory"
import { UniswapV3Factory } from "../typechain-types/@bnb-party/v3-core/contracts/UniswapV3Factory"
import { NonfungiblePositionManager } from "../typechain-types/@bnb-party/v3-periphery/contracts//NonfungiblePositionManager"
import { MockNonfungibleTokenPositionDescriptor } from "../typechain-types/contracts/mock/MockNonfungibleTokenPositionDescriptor"
import { SwapRouter } from "../typechain-types/@bnb-party/v3-periphery/contracts//SwapRouter"
import { expect } from "chai"
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { ERC20Token } from "../typechain-types/"
import { INonfungiblePositionManager } from "../typechain-types/"
import { IUniswapV3Pool } from "../typechain-types/"
import WETH9Artifact from "./WETH9/WETH9.json"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { bytecode } from "../artifacts/@bnb-party/v3-core/contracts/UniswapV3Pool.sol/UniswapV3Pool.json"
import { keccak256 } from "ethers"
import { token } from "../typechain-types/contracts"

export const getMinTick = (tickSpacing: number): number => Math.ceil(-887272 / tickSpacing) * tickSpacing

export const getMaxTick = (tickSpacing: number): number => Math.floor(887272 / tickSpacing) * tickSpacing

export const getMaxLiquidityPerTick = (tickSpacing: number): number => {
    const maxTick = getMaxTick(tickSpacing)
    const minTick = getMinTick(tickSpacing)
    const tickRange = maxTick - minTick

    // Calculate using plain JavaScript arithmetic
    return Math.pow(2, 128) - 1 / (tickRange / tickSpacing + 1)
}

enum FeeAmount {
    LOW = 500,
    MEDIUM = 3000,
    HIGH = 10000,
}

const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
    [FeeAmount.LOW]: 10,
    [FeeAmount.MEDIUM]: 60,
    [FeeAmount.HIGH]: 200,
}

export const POOL_BYTECODE_HASH = keccak256(bytecode)
//console.log(POOL_BYTECODE_HASH)

describe("BNBPartyFactory", function () {
    let signers: SignerWithAddress[]
    let bnbPartyFactory: BNBPartyFactory
    let v3Factory: any
    let positionManager: NonfungiblePositionManager
    let tokenPositionDescriptor: MockNonfungibleTokenPositionDescriptor
    let swapRouter: any
    let weth9: any
    const partyTarget = ethers.parseEther("100")
    const tokenCreationFee = ethers.parseUnits("1", 17)
    const returnFeeAmount = ethers.parseUnits("1", 17)
    const bonusFee = ethers.parseUnits("1", 16)
    const initialTokenAmount = "10000000000000000000000000"
    let token0: ERC20Token
    let token1: ERC20Token
    const sqrtPriceX96 = "250553781928115428981508556680446"

    before(async () => {
        signers = await ethers.getSigners()

        // deploy WEth9
        const WETH9 = await ethers.getContractFactory(WETH9Artifact.abi, WETH9Artifact.bytecode)
        weth9 = await WETH9.deploy()

        const token = await ethers.getContractFactory("ERC20Token")
        token0 = await token.deploy("Token", "TKN", initialTokenAmount)

        token1 = await token.deploy("BNB", "BNB", initialTokenAmount)

        const BNBPartyFactoryContract = await ethers.getContractFactory("BNBPartyFactory")
        bnbPartyFactory = (await BNBPartyFactoryContract.deploy(
            partyTarget,
            tokenCreationFee,
            FeeAmount.HIGH,
            FeeAmount.HIGH,
            initialTokenAmount,
            sqrtPriceX96,
            await weth9.getAddress(),
            returnFeeAmount,
            bonusFee,
            "-92200",
            "0"
        )) as BNBPartyFactory
        // deploy PancakeV3Factory
        const V3FactoryContract = await ethers.getContractFactory("UniswapV3Factory")
        v3Factory = await V3FactoryContract.deploy(await bnbPartyFactory.getAddress())

        const TokenPositionDescriptor = await ethers.getContractFactory("MockNonfungibleTokenPositionDescriptor")
        tokenPositionDescriptor = (await TokenPositionDescriptor.deploy()) as MockNonfungibleTokenPositionDescriptor

        // deploy positionManager
        const PositionManagerContract = await ethers.getContractFactory("NonfungiblePositionManager")
        positionManager = (await PositionManagerContract.deploy(
            await v3Factory.getAddress(),
            await weth9.getAddress(),
            await tokenPositionDescriptor.getAddress()
        )) as NonfungiblePositionManager

        //deploy swapRouter
        const SwapRouterContract = await ethers.getContractFactory("SwapRouter")
        swapRouter = await SwapRouterContract.deploy(await v3Factory.getAddress(), await weth9.getAddress())
        // set positionManager
        await bnbPartyFactory.setNonfungiblePositionManager(
            await positionManager.getAddress(),
            await positionManager.getAddress()
        )
    })

    beforeEach(async () => {})

    it("should deploy BNBPartyFactory", async function () {
        expect(await bnbPartyFactory.partyTarget()).to.equal(partyTarget)
        expect(await bnbPartyFactory.initialTokenAmount()).to.equal(initialTokenAmount)
        expect(await bnbPartyFactory.sqrtPriceX96()).to.equal(sqrtPriceX96)
        expect(await bnbPartyFactory.WBNB()).to.equal(await weth9.getAddress())
        expect(await bnbPartyFactory.bonusTargetReach()).to.equal(returnFeeAmount)
        expect(await bnbPartyFactory.bonusPartyCreator()).to.equal(bonusFee)
        expect(await bnbPartyFactory.lpFee()).to.equal(FeeAmount.HIGH)
        expect(await bnbPartyFactory.partyLPFee()).to.equal(FeeAmount.HIGH)
        expect(await bnbPartyFactory.createTokenFee()).to.equal(tokenCreationFee)
        expect(await bnbPartyFactory.tickUpper()).to.equal("0")
        expect(await bnbPartyFactory.tickLower()).to.equal("-92200")
    })

    it("should create party LP", async function () {
        const name = "Party"
        const symbol = "Token"
        await bnbPartyFactory.createParty(name, symbol)

        expect(await positionManager.totalSupply()).to.equal(1)
    })

    it("bnb factory is owner of the party LP", async () => {
        const name = "Party"
        const symbol = "Token"
        await bnbPartyFactory.createParty(name, symbol)
        const tokenId = (await positionManager.totalSupply()) - 1n
        const owner = await positionManager.ownerOf(tokenId)
        expect(owner).to.equal(await bnbPartyFactory.getAddress())
    })
})
