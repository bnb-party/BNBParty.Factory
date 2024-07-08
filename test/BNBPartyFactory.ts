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
    const fee = "100"
    const buyLimit = ethers.parseEther("100")
    const returnAmount = ethers.parseEther("1")
    const initialTokenAmount = ethers.parseEther("10")
    const token0Price = buyLimit
    const token1Price = 0n

    before(async () => {
        signers = await ethers.getSigners()
        // deploy PancakeV3Factory
        const V3FactoryContract = await ethers.getContractFactory("UniswapV3Factory")
        v3Factory = await V3FactoryContract.deploy(signers[0].address)

        // deploy WEth9
        const WETH9 = await ethers.getContractFactory(WETH9Artifact.abi, WETH9Artifact.bytecode)
        weth9 = await WETH9.deploy()

        const TokenPositionDescriptor = await ethers.getContractFactory("MockNonfungibleTokenPositionDescriptor")
        tokenPositionDescriptor = (await TokenPositionDescriptor.deploy()) as MockNonfungibleTokenPositionDescriptor

        // deploy positionManager
        const PositionManagerContract = await ethers.getContractFactory("NonfungiblePositionManager")
        positionManager = (await PositionManagerContract.deploy(
            await v3Factory.getAddress(),
            await weth9.getAddress(),
            await tokenPositionDescriptor.getAddress()
        )) as NonfungiblePositionManager

        const sqrtPriceX96 = calculateSqrtPriceX96(token1Price, token0Price)
        const BNBPartyFactoryContract = await ethers.getContractFactory("BNBPartyFactory")
        bnbPartyFactory = (await BNBPartyFactoryContract.deploy(
            await positionManager.getAddress(),
            await positionManager.getAddress(),
            fee,
            buyLimit,
            initialTokenAmount,
            sqrtPriceX96,
            await weth9.getAddress(),
            returnAmount
        )) as BNBPartyFactory
        //deploy swapRouter
        const SwapRouterContract = await ethers.getContractFactory("SwapRouter")
        swapRouter = await SwapRouterContract.deploy(await v3Factory.getAddress(), await weth9.getAddress())
    })

    beforeEach(async () => {})

    it("should deploy BNBPartyFactory", async function () {
        expect(await bnbPartyFactory.BNBPositionManager()).to.equal(await positionManager.getAddress())
        expect(await bnbPartyFactory.positionManager()).to.equal(await positionManager.getAddress())
        expect(await bnbPartyFactory.buyLimit()).to.equal(buyLimit)
        expect(await bnbPartyFactory.initialTokenAmount()).to.equal(initialTokenAmount)
        expect(await bnbPartyFactory.sqrtPriceX96()).to.equal(calculateSqrtPriceX96(token1Price, token0Price))
        expect(await bnbPartyFactory.WBNB()).to.equal(await weth9.getAddress())
        expect(await bnbPartyFactory.returnAmount()).to.equal(returnAmount)
        expect(await bnbPartyFactory.fee()).to.equal(fee)
    })

    it("should create party", async function () {
        const name = "Party"
        const symbol = "Token"
        //await bnbPartyFactory.createParty(name, symbol)
    })
})

function calculateSqrtPriceX96(priceToken1: bigint, priceToken0: bigint) {
    if (priceToken0 <= 0) {
        throw new Error("Price of token0 must be greater than 0")
    }
    const priceRatio = priceToken1 / priceToken0
    const sqrtPriceRatio = sqrtBigInt(priceRatio)
    // Multiply by 2^96
    return sqrtPriceRatio * 2n ** 96n
}

function sqrtBigInt(value: bigint) {
    if (value < 0n) {
        throw new Error("Square root of negative numbers is not supported")
    }

    if (value < 2n) {
        return value
    }

    let x0 = value
    let x1 = (value >> 1n) + 1n
    while (x1 < x0) {
        x0 = x1
        x1 = (value / x1 + x1) >> 1n
    }
    return x0
}
