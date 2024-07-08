import { BNBPartyFactory } from "../typechain-types/contracts/BNBPartyFactory"
import PancakeV3FactoryArtifact from "@pancakeswap/v3-core/artifacts/contracts/PancakeV3Factory.sol/PancakeV3Factory.json"
import PancakeV3PoolArtifact from "@pancakeswap/v3-core/artifacts/contracts/PancakeV3Pool.sol/PancakeV3Pool.json"
import PositionManagerArtifact from "@pancakeswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"
import SwapRouterArtifact from "@pancakeswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"
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
    let pancakeV3Factory: any
    let pancakeV3Pool: IUniswapV3Pool
    let positionManager: INonfungiblePositionManager
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
        const PancakeV3FactoryContract = await ethers.getContractFactory(
            PancakeV3FactoryArtifact.abi,
            PancakeV3FactoryArtifact.bytecode
        )
        pancakeV3Factory = await PancakeV3FactoryContract.deploy(signers[0].address)

        // deploy WEth9
        const WETH9 = await ethers.getContractFactory(WETH9Artifact.abi, WETH9Artifact.bytecode)
        weth9 = await WETH9.deploy()

        // deploy positionManager
        const PositionManagerContract = await ethers.getContractFactory(
            PositionManagerArtifact.abi,
            PositionManagerArtifact.bytecode
        )
        positionManager = (await PositionManagerContract.deploy(
            signers[0].address,
            await pancakeV3Factory.getAddress(),
            await pancakeV3Factory.getAddress(),
            await pancakeV3Factory.getAddress()
        )) as INonfungiblePositionManager

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
        const SwapRouterContract = await ethers.getContractFactory(SwapRouterArtifact.abi, SwapRouterArtifact.bytecode)
        swapRouter = await SwapRouterContract.deploy(
            signers[0].address,
            await pancakeV3Factory.getAddress(),
            await weth9.getAddress()
        )
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
