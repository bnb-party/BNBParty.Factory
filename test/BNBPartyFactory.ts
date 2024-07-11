import { expect } from "chai"
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { BNBPartyFactory } from "../typechain-types/contracts/BNBPartyFactory"
import { UniswapV3Factory } from "../typechain-types/@bnb-party/v3-core/contracts/UniswapV3Factory"
import { NonfungiblePositionManager } from "../typechain-types/@bnb-party/v3-periphery/contracts/NonfungiblePositionManager"
import { MockNonfungibleTokenPositionDescriptor } from "../typechain-types/contracts/mock/MockNonfungibleTokenPositionDescriptor"
import { SwapRouter } from "../typechain-types/@bnb-party/v3-periphery/contracts/SwapRouter"
import { AbiCoder, keccak256 } from "ethers"
import WETH9Artifact from "./WETH9/WETH9.json"
import { bytecode } from "../artifacts/@bnb-party/v3-core/contracts/UniswapV3Pool.sol/UniswapV3Pool.json"

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

const POOL_BYTECODE_HASH = keccak256(bytecode)
//console.log(POOL_BYTECODE_HASH)

describe("BNBPartyFactory", function () {
    let signers: SignerWithAddress[]
    let bnbPartyFactory: BNBPartyFactory
    let v3Factory: UniswapV3Factory
    let positionManager: NonfungiblePositionManager
    let tokenPositionDescriptor: MockNonfungibleTokenPositionDescriptor
    let swapRouter: SwapRouter
    let weth9: any
    let tokenId: string
    const partyTarget = ethers.parseEther("100")
    const tokenCreationFee = ethers.parseUnits("1", 17)
    const returnFeeAmount = ethers.parseUnits("1", 17)
    const bonusFee = ethers.parseUnits("1", 16)
    const initialTokenAmount = "10000000000000000000000000"
    const sqrtPriceX96 = "250553781928115428981508556680446"

    before(async () => {
        signers = await ethers.getSigners()

        // Deploy WETH9
        const WETH9 = await ethers.getContractFactory(WETH9Artifact.abi, WETH9Artifact.bytecode)
        weth9 = await WETH9.deploy()

        // Deploy BNBPartyFactory
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

        // Deploy Uniswap V3 Factory
        const V3FactoryContract = await ethers.getContractFactory("UniswapV3Factory")
        v3Factory = (await V3FactoryContract.deploy(await bnbPartyFactory.getAddress())) as UniswapV3Factory

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

        // Deploy Swap Router
        const SwapRouterContract = await ethers.getContractFactory("SwapRouter")
        swapRouter = (await SwapRouterContract.deploy(
            await v3Factory.getAddress(),
            await weth9.getAddress()
        )) as SwapRouter

        // Set Position Manager in BNBPartyFactory
        await bnbPartyFactory.setNonfungiblePositionManager(
            await positionManager.getAddress(),
            await positionManager.getAddress()
        )
    })

    beforeEach(async () => {
        tokenId = (await positionManager.totalSupply()).toString()
    })

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

    it("should swap tokens", async () => {
        const amountIn = ethers.parseUnits("1", 17)
        const position = await positionManager.positions(tokenId)
        const token0 = position.token0
        const token1 = position.token1
        const amountOutMinimum = 0 // For testing, accept any amount out

        // Manually encode the path using ethers v6
        const path = ethers.concat([
            ethers.zeroPadValue(token0, 20),
            ethers.zeroPadValue(ethers.toBeHex(FeeAmount.HIGH), 3),
            ethers.zeroPadValue(token1, 20),
        ])

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now
        await weth9.deposit({ value: amountIn })
        await weth9.approve(await swapRouter.getAddress(), amountIn)

        const params = {
            path: path,
            recipient: await signers[0].getAddress(),
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
        }

        const token1Contract = await ethers.getContractAt("ERC20Token", token1)

        const balanceBefore = await token1Contract.balanceOf(await signers[0].getAddress())
        await swapRouter.exactInput(params)
        const balanceAfter = await token1Contract.balanceOf(await signers[0].getAddress())

        expect(balanceAfter).to.be.gt(balanceBefore)
    })
})
