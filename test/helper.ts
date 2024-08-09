import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { BNBPartyFactory } from "../typechain-types/contracts/BNBPartyFactory"
import { UniswapV3Factory } from "../typechain-types/@bnb-party/v3-core/contracts/UniswapV3Factory"
import { NonfungiblePositionManager } from "../typechain-types/@bnb-party/v3-periphery/contracts/NonfungiblePositionManager"
import { MockNonfungibleTokenPositionDescriptor } from "../typechain-types/contracts/mock/MockNonfungibleTokenPositionDescriptor"
import { SwapRouter } from "../typechain-types/@bnb-party/v3-periphery/contracts/SwapRouter"
import { IWBNB } from "../typechain-types/contracts/interfaces/IWBNB"
import WETH9Artifact from "./WETH9/WETH9.json"
import FactoryArtifact from "@bnb-party/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"
import ClassicFactoryArtifact from "@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"
import ClassicNonfungiblePositionManager from "@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"
import ClassicSwapRouter from "@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"

export enum FeeAmount {
    LOW = 500,
    MEDIUM = 3000,
    HIGH = 10000,
}

export function getDataHexString(token0: string, token1: string) {
    return ethers.concat([
        ethers.zeroPadValue(token0, 20),
        ethers.zeroPadValue(ethers.toBeHex(FeeAmount.HIGH), 3),
        ethers.zeroPadValue(token1, 20),
    ])
}

export let bnbPartyFactory: BNBPartyFactory
export let v3Factory: UniswapV3Factory
export let v3PartyFactory: UniswapV3Factory
export let positionManager: NonfungiblePositionManager
export let BNBPositionManager: NonfungiblePositionManager
export let tokenPositionDescriptor: MockNonfungibleTokenPositionDescriptor
export let BNBSwapRouter: SwapRouter
export let swapRouter: SwapRouter
export let weth9: IWBNB

export async function deployContracts() {
    const partyTarget = ethers.parseEther("90")
    const tokenCreationFee = ethers.parseUnits("1", 16)
    const returnFeeAmount = ethers.parseUnits("5", 17)
    const bonusFee = ethers.parseUnits("1", 16)
    const targetReachFee = ethers.parseUnits("1", 17)
    const initialTokenAmount = "1000000000000000000000000000"
    const sqrtPriceX96 = "7922427122162318518285487"
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
            tickLower: "-203800",
            tickUpper: "184200",
        },
        await weth9.getAddress()
    )) as BNBPartyFactory

    // Deploy Uniswap V3 Factory
    const v3PartyFactoryContract = await ethers.getContractFactory(FactoryArtifact.abi, FactoryArtifact.bytecode)
    const v3FactoryContract = await ethers.getContractFactory(ClassicFactoryArtifact.abi, ClassicFactoryArtifact.bytecode)
    v3Factory = (await v3FactoryContract.deploy()) as UniswapV3Factory

    v3PartyFactory = (await v3PartyFactoryContract.deploy(await bnbPartyFactory.getAddress())) as UniswapV3Factory

    // Deploy Token Position Descriptor
    const TokenPositionDescriptor = await ethers.getContractFactory("MockNonfungibleTokenPositionDescriptor")
    tokenPositionDescriptor = (await TokenPositionDescriptor.deploy()) as MockNonfungibleTokenPositionDescriptor

    // Deploy Position Manager
    const ManagerContract = await ethers.getContractFactory(ClassicNonfungiblePositionManager.abi, ClassicNonfungiblePositionManager.bytecode)
    positionManager = (await ManagerContract.deploy(
        await v3Factory.getAddress(),
        await weth9.getAddress(),
        await tokenPositionDescriptor.getAddress()
    )) as NonfungiblePositionManager

    const PositionManagerContract = await ethers.getContractFactory("NonfungiblePositionManager")
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

    const routerContract = await ethers.getContractFactory(ClassicSwapRouter.abi, ClassicSwapRouter.bytecode)
    swapRouter = (await routerContract.deploy(await v3Factory.getAddress(), await weth9.getAddress())) as SwapRouter

    // Set Position Manager in BNBPartyFactory
    await bnbPartyFactory.setNonfungiblePositionManager(
        await BNBPositionManager.getAddress(),
        await positionManager.getAddress()
    )
    // Set Swap Router in BNBPartyFactory
    await bnbPartyFactory.setBNBPartySwapRouter(await BNBSwapRouter.getAddress())
    await bnbPartyFactory.setSwapRouter(await swapRouter.getAddress())
}
