import { expect } from "chai"
import { ethers } from "hardhat"
import { IWBNB } from "../typechain-types/contracts/interfaces/IWBNB"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { BNBPartyFactory } from "../typechain-types/contracts/BNBPartyFactory"
import { ERC20 } from "../typechain-types"
import { UniswapV3Factory } from "../typechain-types/@bnb-party/v3-core/contracts/UniswapV3Factory"
import { NonfungiblePositionManager } from "../typechain-types/@bnb-party/v3-periphery/contracts/NonfungiblePositionManager"
import { MockNonfungibleTokenPositionDescriptor } from "../typechain-types/contracts/mock/MockNonfungibleTokenPositionDescriptor"
import { SwapRouter } from "../typechain-types/@bnb-party/v3-periphery/contracts/SwapRouter"
import WETH9Artifact from "./WETH9/WETH9.json"
import FactoryArtifact from "@bnb-party/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"
import { FeeAmount, getDataHexString } from "./helper"

describe("Smart Router", function () {
    let signers: SignerWithAddress[]
    let bnbPartyFactory: BNBPartyFactory
    let v3Factory: UniswapV3Factory
    let v3PartyFactory: UniswapV3Factory
    let positionManager: NonfungiblePositionManager
    let BNBPositionManager: NonfungiblePositionManager
    let tokenPositionDescriptor: MockNonfungibleTokenPositionDescriptor
    let BNBSwapRouter: SwapRouter
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
    let tokenId: string
    let deadline: number
    let position: any
    let MEME: string
    let lpAddress: string
    let MEMEToken: ERC20

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
        // Create a party
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        tokenId = (await BNBPositionManager.totalSupply()).toString()
        deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now
        position = await BNBPositionManager.positions(tokenId)
        MEME = position.token1 == (await weth9.getAddress()) ? position.token0 : position.token1
        lpAddress = await v3PartyFactory.getPool(await weth9.getAddress(), MEME, FeeAmount.HIGH)
        MEMEToken = await ethers.getContractAt("ERC20", MEME)
        await MEMEToken.approve(await bnbPartyFactory.getAddress(), ethers.parseEther("100"))
        await MEMEToken.approve(await BNBSwapRouter.getAddress(), ethers.parseEther("100"))
    })

    it("should increase wbnb on party lp after join party", async () => {
        const amountIn = ethers.parseUnits("5", 17)
        const lpBalanceBefore = await weth9.balanceOf(lpAddress)
        await bnbPartyFactory.joinParty(MEME, 0, { value: amountIn })
        const lpBalanceAfter = await weth9.balanceOf(lpAddress)
        expect(lpBalanceAfter).to.be.equal(lpBalanceBefore + amountIn)
    })

    it("user should receive meme token after join party", async () => {
        const amountIn = ethers.parseUnits("5", 17)

        const balanceBefore = await MEMEToken.balanceOf(await signers[0].getAddress())
        await bnbPartyFactory.joinParty(MEME, 0, { value: amountIn })
        const balanceAfter = await MEMEToken.balanceOf(await signers[0].getAddress())
        expect(balanceAfter).to.be.gt(balanceBefore)
    })

    it("user should receive bnb after leave party", async () => {
        const amountIn = ethers.parseUnits("5", 16)
        const bnbBalanceBefore = await ethers.provider.getBalance(await signers[0].getAddress())
        await bnbPartyFactory.leaveParty(MEME, amountIn, 0)
        const bnbBalanceAfter = await ethers.provider.getBalance(await signers[0].getAddress())
        expect(bnbBalanceAfter).to.be.gt(bnbBalanceBefore)
    })

    it("swap router should send all bnb balance after leave party", async () => {
        const amountIn = ethers.parseUnits("1", 16)
        await bnbPartyFactory.leaveParty(MEME, amountIn, 0)
        const bnbBalance = await ethers.provider.getBalance(await BNBSwapRouter.getAddress())
        expect(bnbBalance).to.be.equal(0)
    })

    it("should deacrease wbnb on party lp after leave party", async () => {
        const amountIn = ethers.parseUnits("1", 16)

        const lpBalanceBefore = await weth9.balanceOf(lpAddress)
        await bnbPartyFactory.leaveParty(MEME, amountIn, 0)
        const lpBalanceAfter = await weth9.balanceOf(lpAddress)

        expect(lpBalanceBefore).to.be.gt(lpBalanceAfter)
    })

    it("BNB -> WBNB -> MEME exactInput call", async () => {
        const amountIn = ethers.parseUnits("1", 18)
        const path = getDataHexString(await weth9.getAddress(), MEME)

        const params = {
            path: path,
            recipient: await signers[0].getAddress(),
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: "0",
        }

        const balanceBefore = await MEMEToken.balanceOf(await signers[0].getAddress())
        await expect(await BNBSwapRouter.exactInput(params, { value: amountIn })).to.emit(weth9, "Deposit")
        const balanceAfter = await MEMEToken.balanceOf(await signers[0].getAddress())

        expect(balanceAfter).to.be.gt(balanceBefore)
    })

    it("MEME -> WBNB -> BNB multicall", async function () {
        const amountIn = ethers.parseUnits("1", 17)
        const MEME = position.token0
        const path = getDataHexString(MEME, await weth9.getAddress())

        const params = {
            path: path,
            recipient: ethers.ZeroAddress,
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: "0",
        }

        const exactInputData = BNBSwapRouter.interface.encodeFunctionData("exactInput", [params])
        // Encode the unwrapWETH9 call to convert WETH to ETH
        const unwrapWETH9Data = BNBSwapRouter.interface.encodeFunctionData("unwrapWETH9", [
            "0",
            await signers[1].getAddress(),
        ])
        const balanceBefore = await ethers.provider.getBalance(await signers[1].getAddress())
        await expect(await BNBSwapRouter.multicall([exactInputData, unwrapWETH9Data])).to.emit(weth9, "Withdrawal")
        const balanceAfter = await ethers.provider.getBalance(await signers[1].getAddress())
        expect(balanceAfter).to.be.gt(balanceBefore)
    })

    it("WBNB -> MEME exactInput call", async () => {
        const amountIn = ethers.parseUnits("1", 17)
        const amountOutMinimum = 0 // For testing, accept any amount out
        const path = getDataHexString(await weth9.getAddress(), MEME)

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now
        await weth9.deposit({ value: amountIn })
        await weth9.approve(await BNBSwapRouter.getAddress(), amountIn)

        const params = {
            path: path,
            recipient: await signers[0].getAddress(),
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
        }

        const balanceBefore = await MEMEToken.balanceOf(await signers[0].getAddress())
        await BNBSwapRouter.exactInput(params)
        const balanceAfter = await MEMEToken.balanceOf(await signers[0].getAddress())

        expect(balanceAfter).to.be.gt(balanceBefore)
    })

    it("execute auto-swap", async () => {
        const amountIn = ethers.parseUnits("1", 17)
        const tx = await bnbPartyFactory.createParty(name, symbol, { value: amountIn })
        await tx.wait()
        const events = await bnbPartyFactory.queryFilter(bnbPartyFactory.filters["StartParty(address,address,address)"])
        const tokenAddress = events[events.length - 1].args.tokenAddress
        const lpAddress = await v3PartyFactory.getPool(await weth9.getAddress(), tokenAddress, FeeAmount.HIGH)
        // check liquidity pool balance
        const liquidityPoolBalance = await weth9.balanceOf(lpAddress)
        expect(liquidityPoolBalance).to.be.equal(amountIn - tokenCreationFee)
    })

    it("should increase user tokens with excess party fee", async () => {
        const amountIn = ethers.parseUnits("1", 17)
        const tx = await bnbPartyFactory.createParty(name, symbol, { value: amountIn })
        await tx.wait()
        const events = await bnbPartyFactory.queryFilter(bnbPartyFactory.filters["StartParty(address,address,address)"])
        const tokenAddress = events[events.length - 1].args.tokenAddress
        const token = await ethers.getContractAt("ERC20Token", tokenAddress)

        const balance = await token.balanceOf(await signers[0].getAddress())
        expect(balance).to.be.gt(0)
    })

    it("should revert tokenOut zero address on join party", async () => {
        await expect(
            bnbPartyFactory.joinParty(ethers.ZeroAddress, 0, { value: ethers.parseUnits("1", 17) })
        ).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroAddress")
    })

    it("should revert zero msg.value on join party", async () => {
        await expect(bnbPartyFactory.joinParty(MEME, 0)).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroAmount")
    })

    it('should revert if "amountIn" is zero on leave party', async () => {
        await expect(bnbPartyFactory.leaveParty(MEME, 0, 0)).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "ZeroAmount"
        )
    })

    it("should revert if tokenOut zero address on leave party", async () => {
        await expect(
            bnbPartyFactory.leaveParty(ethers.ZeroAddress, ethers.parseUnits("1", 16), 0)
        ).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroAddress")
    })
})
