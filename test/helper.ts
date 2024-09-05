import { ethers } from "hardhat"
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
import { SqrtPriceCalculator } from "../typechain-types/contracts/calc/SqrtPriceCalculator"

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

export async function deployContracts(partyTarget = ethers.parseEther("90"), weth9Address: string = "") {
    const tokenCreationFee = ethers.parseUnits("1", 16) // 0.01 BNB token creation fee
    const returnFeeAmount = ethers.parseUnits("5", 16) // 0.05 BNB return fee (bonusTargetReach)
    const bonusFee = ethers.parseUnits("1", 17) // 0.1 BNB bonus fee (bonusPartyCreator)
    const targetReachFee = ethers.parseUnits("8.5", 17) // 0.85 BNB target reach fee
    const initialTokenAmount = "1000000000000000000000000000"
    const sqrtPriceX96 = "1252685732681638336686364"
    // Deploy WETH9
    if (weth9Address === "") {
        weth9 = await deployWBNB()
        weth9Address = await weth9.getAddress()
    }
    const sqrtPriceCalculatorContract = await ethers.getContractFactory("SqrtPriceCalculator")
    const sqrtPriceCalculator = (await sqrtPriceCalculatorContract.deploy()) as SqrtPriceCalculator
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
            partyTicks: { tickLower: "-214200", tickUpper: "195600" },
            lpTicks: { tickLower: "-214200", tickUpper: "201400" },
        },
        weth9Address,
        await sqrtPriceCalculator.getAddress()
    )) as BNBPartyFactory

    // Deploy Uniswap V3 Factory
    const v3PartyFactoryContract = await ethers.getContractFactory(FactoryArtifact.abi, FactoryArtifact.bytecode)
    const v3FactoryContract = await ethers.getContractFactory(
        ClassicFactoryArtifact.abi,
        ClassicFactoryArtifact.bytecode
    )
    v3Factory = (await v3FactoryContract.deploy()) as UniswapV3Factory

    v3PartyFactory = (await v3PartyFactoryContract.deploy(await bnbPartyFactory.getAddress())) as UniswapV3Factory

    // Deploy Token Position Descriptor
    const TokenPositionDescriptor = await ethers.getContractFactory("MockNonfungibleTokenPositionDescriptor")
    tokenPositionDescriptor = (await TokenPositionDescriptor.deploy()) as MockNonfungibleTokenPositionDescriptor

    // Deploy Position Manager
    const ManagerContract = await ethers.getContractFactory(
        ClassicNonfungiblePositionManager.abi,
        ClassicNonfungiblePositionManager.bytecode
    )
    positionManager = (await ManagerContract.deploy(
        await v3Factory.getAddress(),
        weth9Address,
        await tokenPositionDescriptor.getAddress()
    )) as NonfungiblePositionManager

    const PositionManagerContract = await ethers.getContractFactory("NonfungiblePositionManager")
    BNBPositionManager = (await PositionManagerContract.deploy(
        await v3PartyFactory.getAddress(),
        weth9Address,
        await tokenPositionDescriptor.getAddress()
    )) as NonfungiblePositionManager

    // Deploy Swap Router
    const SwapRouterContract = await ethers.getContractFactory("SwapRouter")
    BNBSwapRouter = (await SwapRouterContract.deploy(
        await v3PartyFactory.getAddress(),
        weth9Address
    )) as SwapRouter

    const routerContract = await ethers.getContractFactory(ClassicSwapRouter.abi, ClassicSwapRouter.bytecode)
    swapRouter = (await routerContract.deploy(await v3Factory.getAddress(), weth9Address)) as SwapRouter

    // Set Position Manager in BNBPartyFactory
    await bnbPartyFactory.setNonfungiblePositionManager(
        await BNBPositionManager.getAddress(),
        await positionManager.getAddress()
    )
    // Set Swap Router in BNBPartyFactory
    await bnbPartyFactory.setBNBPartySwapRouter(await BNBSwapRouter.getAddress())
    await bnbPartyFactory.setSwapRouter(await swapRouter.getAddress())
}

export async function deployBNBPartyFactory(
    partyTarget: bigint,
    tokenCreationFee: bigint,
    returnFeeAmount: bigint,
    bonusFee: bigint,
    targetReachFee: bigint,
    initialTokenAmount: string,
    sqrtPriceX96: string,
    WBNB: string,
    sqrtPriceCalculator: string
) {
    const BNBPartyFactoryContract = await ethers.getContractFactory("BNBPartyFactory")
    return BNBPartyFactoryContract.deploy(
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
            partyTicks: { tickLower: "-214200", tickUpper: "195600" },
            lpTicks: { tickLower: "-214200", tickUpper: "201400" },
        },
        WBNB,
        sqrtPriceCalculator
    )
}

export async function maxAndMinWBNB() {
    const deploymentCount = 100;
    let maxAddress = ethers.ZeroAddress;
    let minAddress = '0xffffffffffffffffffffffffffffffffffffffff'; // A large value to start with

    for (let i = 0; i < deploymentCount; i++) {
        const wbnb = await deployWBNB();
        const address = await wbnb.getAddress();

        // Update maxAddress and minAddress based on comparison
        maxAddress = address > maxAddress ? address : maxAddress;
        minAddress = address < minAddress ? address : minAddress;
    }
    return { maxAddress: maxAddress, minAddress: minAddress };
}

async function deployWBNB(): Promise<IWBNB> {
    const WBNBFactory = await ethers.getContractFactory(WETH9Artifact.abi, WETH9Artifact.bytecode)
    return (await WBNBFactory.deploy()) as IWBNB
}