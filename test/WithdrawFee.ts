import { expect } from "chai"
import { ethers } from "hardhat"
import { IWBNB } from "../typechain-types/contracts/interfaces/IWBNB"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { BNBPartyFactory } from "../typechain-types/contracts/BNBPartyFactory"
import { UniswapV3Factory } from "../typechain-types/@bnb-party/v3-core/contracts/UniswapV3Factory"
import { NonfungiblePositionManager } from "../typechain-types/@bnb-party/v3-periphery/contracts/NonfungiblePositionManager"
import { MockNonfungibleTokenPositionDescriptor } from "../typechain-types/contracts/mock/MockNonfungibleTokenPositionDescriptor"
import { SwapRouter } from "../typechain-types/@bnb-party/v3-periphery/contracts/SwapRouter"
import WETH9Artifact from "./WETH9/WETH9.json"
import { IUniswapV3Pool } from "../typechain-types"
import FactoryArtifact from "@bnb-party/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"
import { FeeAmount, getDataHexString } from "./helper"

describe("Withdraw fees", function () {
    let MEME: string
    let tokenId: string
    let position: any
    const amountIn = ethers.parseUnits("1", 18)
    let lpAddress: string
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

    beforeEach(async () => {
        signers = await ethers.getSigners()
        await deployContracts()
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        tokenId = (await BNBPositionManager.totalSupply()).toString()
        position = await BNBPositionManager.positions(tokenId)
        MEME = position.token1 == (await weth9.getAddress()) ? position.token0 : position.token1
        lpAddress = await v3PartyFactory.getPool(MEME, await weth9.getAddress(), FeeAmount.HIGH)
    })

    it("should withdraw token creation fee", async () => {
        await deployContracts()
        const numbersOfParties = 5n
        for (let i = 0; i < numbersOfParties; ++i) {
            await bnbPartyFactory.connect(signers[1]).createParty(name, symbol, { value: tokenCreationFee })
        }
        const balanceBefore = await ethers.provider.getBalance(await signers[0].getAddress())
        const tx: any = await bnbPartyFactory.withdrawFee()
        const txReceipt = await tx.wait()
        const gasCost = ethers.toBigInt(txReceipt.gasUsed) * ethers.toBigInt(tx.gasPrice)
        const balanceAfter = await ethers.provider.getBalance(await signers[0].getAddress())
        expect(balanceAfter).to.be.equal(balanceBefore - gasCost + tokenCreationFee * numbersOfParties)
    })

    it("should withdraw party fee", async () => {
        await bnbPartyFactory.connect(signers[1]).createParty(name, symbol, { value: tokenCreationFee })
        tokenId = (await BNBPositionManager.totalSupply()).toString()
        position = await BNBPositionManager.positions(tokenId)
        MEME = position.token1 == (await weth9.getAddress()) ? position.token0 : position.token1
        await bnbPartyFactory.connect(signers[1]).joinParty(MEME, 0, { value: ethers.parseEther("10") })
        position = await BNBPositionManager.positions(tokenId)
        // 1% bnb party fee 10 ether = 0.1 ether
        const expectedFee = ethers.parseEther("0.1")
        const balanceBefore = await weth9.balanceOf(await signers[0].getAddress())
        const partyLP = await v3PartyFactory.getPool(await weth9.getAddress(), MEME, FeeAmount.HIGH)
        await bnbPartyFactory.withdrawPartyLPFee([partyLP])
        const balanceAfter = await weth9.balanceOf(await signers[0].getAddress())
        expect(balanceAfter).to.be.equal(balanceBefore + expectedFee - 1n)
    })

    it("should revert LPNotAtParty", async () => {
        await bnbPartyFactory.connect(signers[1]).joinParty(MEME, 0, { value: BNBToTarget })
        // do swap from second LP
        const amountIn = ethers.parseUnits("1", 17)
        const amountOutMinimum = 0 // For testing, accept any amount out
        const path = getDataHexString(await weth9.getAddress(), MEME)
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now
        const params = {
            path: path,
            recipient: await signers[0].getAddress(),
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
        }
        await expect(
            swapRouter.connect(signers[1]).exactInput(params, { value: amountIn })
        ).to.be.revertedWithCustomError(bnbPartyFactory, "LPNotAtParty")
    })

    it("calculateFees should return zero if no swaps", async () => {
        const lpPool = (await ethers.getContractAt("UniswapV3Pool", lpAddress)) as any as IUniswapV3Pool
        const liquidity = await lpPool.liquidity()
        const feeGrowthGlobalX128 = await lpPool.feeGrowthGlobal1X128()
        const fees = await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobalX128)
        expect(fees).to.be.equal(0)
    })

    it("calculateFees should return fee from swap", async () => {
        await bnbPartyFactory.joinParty(MEME, 0, { value: amountIn })
        const lpPool = (await ethers.getContractAt("UniswapV3Pool", lpAddress)) as any as IUniswapV3Pool
        const liquidity = await lpPool.liquidity()
        const feeGrowthGlobalX128 = await lpPool.feeGrowthGlobal1X128()
        expect(await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobalX128)).to.be.equal(amountIn / 100n - 1n) // 1 % fee
    })

    it("calculateFees should return fee from 5 swaps", async () => {
        for (let i = 0; i < 5; i++) {
            await bnbPartyFactory.joinParty(MEME, 0, { value: amountIn })
        }
        const lpPool = (await ethers.getContractAt("UniswapV3Pool", lpAddress)) as any as IUniswapV3Pool
        const liquidity = await lpPool.liquidity()
        const feeGrowthGlobalX128 = await lpPool.feeGrowthGlobal1X128()
        expect(await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobalX128)).to.be.equal(amountIn / 20n - 1n) // 1 % fee
    })

    it("isToken0WBNB should return false if token0 is not WBNB", async () => {
        expect(await bnbPartyFactory.isToken0WBNB(lpAddress)).to.be.false
    })

    it("isToken0WBNB should revert if set zero address", async () => {
        await expect(bnbPartyFactory.isToken0WBNB(ethers.ZeroAddress)).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "ZeroAddress"
        )
    })

    it("should deacrease fee after withdraw", async () => {
        for (let i = 0; i < 5; i++) {
            await bnbPartyFactory.joinParty(MEME, 0, { value: amountIn })
        }
        const lpPool = (await ethers.getContractAt("UniswapV3Pool", lpAddress)) as any as IUniswapV3Pool
        await bnbPartyFactory.withdrawPartyLPFee([lpAddress])
        let liquidity = await lpPool.liquidity()
        let feeGrowthGlobalX128 =
            position.token1 == (await weth9.getAddress())
                ? await lpPool.feeGrowthGlobal1X128()
                : await lpPool.feeGrowthGlobal0X128()
        const collectedFee = await bnbPartyFactory.getFeeGrowthInsideLastX128(lpAddress)
        expect(
            await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobalX128 - collectedFee.feeGrowthInside0LastX128)
        ).to.be.equal(0)
    })

    it("should revert zero lenght array", async () => {
        await expect(bnbPartyFactory.withdrawLPFee([])).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroLength")
    })
})
