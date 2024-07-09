import { BNBPartyFactory } from "../typechain-types/contracts/BNBPartyFactory"
import { UniswapV3Factory } from "../typechain-types/@bnb-party/v3-core/contracts/UniswapV3Factory"
import { NonfungiblePositionManager } from "../typechain-types/@bnb-party/v3-periphery/contracts//NonfungiblePositionManager"
import { MockNonfungibleTokenPositionDescriptor } from "../typechain-types/contracts/mock/MockNonfungibleTokenPositionDescriptor"
import { SwapRouter } from "../typechain-types/@bnb-party/v3-periphery/contracts//SwapRouter"
import { expect } from "chai"
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { INonfungiblePositionManager } from "../typechain-types/"
import { IUniswapV3Pool } from "../typechain-types/"
import WETH9Artifact from "./WETH9/WETH9.json"
import { time } from "@nomicfoundation/hardhat-network-helpers"

describe("BNBPartyFactory", function () {
    let signers: SignerWithAddress[]
    let bnbPartyFactory: BNBPartyFactory
    let bnbFactory: any
    let v3Factory: any
    let positionManager: NonfungiblePositionManager
    let tokenPositionDescriptor: MockNonfungibleTokenPositionDescriptor
    let swapRouter: any
    let weth9: any
    const fee = "500"
    const buyLimit = ethers.parseEther("100")
    const returnAmount = ethers.parseEther("1")
    const initialTokenAmount = ethers.parseEther("10")
    const token0Price = 0n
    const token1Price = buyLimit

    // 10_00_00 tokensB to 1 tokenA
    const sqrtPriceX96 = 79228162514264337593543950336000n

    before(async () => {
        signers = await ethers.getSigners()

        // deploy WEth9
        const WETH9 = await ethers.getContractFactory(WETH9Artifact.abi, WETH9Artifact.bytecode)
        weth9 = await WETH9.deploy()

        const BNBPartyFactoryContract = await ethers.getContractFactory("BNBPartyFactory")
        bnbPartyFactory = (await BNBPartyFactoryContract.deploy(
            fee,
            buyLimit,
            initialTokenAmount,
            sqrtPriceX96,
            await weth9.getAddress(),
            returnAmount
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
        expect(await bnbPartyFactory.buyLimit()).to.equal(buyLimit)
        expect(await bnbPartyFactory.initialTokenAmount()).to.equal(initialTokenAmount)
        expect(await bnbPartyFactory.sqrtPriceX96()).to.equal(sqrtPriceX96)
        expect(await bnbPartyFactory.WBNB()).to.equal(await weth9.getAddress())
        expect(await bnbPartyFactory.returnAmount()).to.equal(returnAmount)
        expect(await bnbPartyFactory.fee()).to.equal(fee)
    })

    it("should create party", async function () {
        const name = "Party"
        const symbol = "Token"
        await bnbPartyFactory.createParty(name, symbol)
    })
})