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

enum FeeAmount {
    LOW = 500,
    MEDIUM = 3000,
    HIGH = 10000,
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
    let weth9: IWBNB
    const partyTarget = ethers.parseEther("100")
    const tokenCreationFee = ethers.parseUnits("1", 16)
    const returnFeeAmount = ethers.parseUnits("1", 17)
    const bonusFee = ethers.parseUnits("1", 16)
    const initialTokenAmount = "10000000000000000000000000"
    const name = "Party"
    const symbol = "Token"
    const sqrtPriceX96 = "250553781928115428981508556680446"

    before(async () => {
        signers = await ethers.getSigners()

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
                tickLower: "-92200",
                tickUpper: "0",
            },
            await weth9.getAddress()
        )) as BNBPartyFactory

        // Deploy Uniswap V3 Factory
        const V3FactoryContract = await ethers.getContractFactory(FactoryArtifact.abi, FactoryArtifact.bytecode)
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
        // Set Swap Router in BNBPartyFactory
        await bnbPartyFactory.setSwapRouter(await swapRouter.getAddress())
    })

    beforeEach(async () => {})

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
        expect(await positionManager.totalSupply()).to.equal(1)
    })

    it("bnb factory is owner of the party LP", async () => {
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        const tokenId = (await positionManager.totalSupply()) - 1n
        const owner = await positionManager.ownerOf(tokenId)
        expect(owner).to.equal(await bnbPartyFactory.getAddress())
    })

    it("should revert if not enough BNB is sent", async function () {
        await expect(bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee - 1n })).to.be.revertedWith(
            "BNBPartyFactory: insufficient BNB"
        )
    })

    it("should revert to Create Party if position manager is not set", async function () {
        await bnbPartyFactory.setNonfungiblePositionManager(ethers.ZeroAddress, ethers.ZeroAddress)
        await expect(bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })).to.be.revertedWith(
            "BNBPartyFactory: BNBPositionManager not set"
        )
        await bnbPartyFactory.setNonfungiblePositionManager(
            await positionManager.getAddress(),
            await positionManager.getAddress()
        )
    })

    it("should revert if swap router is not set", async function () {
        const amountIn = ethers.parseUnits("1", 18)
        await bnbPartyFactory.setSwapRouter(ethers.ZeroAddress)
        await expect(bnbPartyFactory.createParty(name, symbol, { value: amountIn })).to.be.revertedWith(
            "BNBPartyFactory: swapRouter not set"
        )
        await bnbPartyFactory.setSwapRouter(await swapRouter.getAddress())
    })

    describe("Smart Router", function () {
        let tokenId: string
        let deadline: number
        let position: any
        let MEME: string

        before(async () => {
            tokenId = (await positionManager.totalSupply()).toString()
            deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now
            position = await positionManager.positions(tokenId)
            MEME = position.token1
        })

        it("should increase wbnb on party lp after join party", async () => {
            const amountIn = ethers.parseUnits("5", 17)

            const lpBalanceBefore = await weth9.balanceOf(
                await v3Factory.getPool(await weth9.getAddress(), MEME, FeeAmount.HIGH)
            )
            await bnbPartyFactory.joinParty(MEME, 0, deadline, { value: amountIn })
            const lpBalanceAfter = await weth9.balanceOf(
                await v3Factory.getPool(await weth9.getAddress(), MEME, FeeAmount.HIGH)
            )

            expect(lpBalanceAfter).to.be.equal(lpBalanceBefore + amountIn)
        })

        it("user should receive meme token after join party", async () => {
            const amountIn = ethers.parseUnits("5", 17)
            const tokenOutContract = await ethers.getContractAt("ERC20", MEME)

            const balanceBefore = await tokenOutContract.balanceOf(await signers[0].getAddress())
            await bnbPartyFactory.joinParty(MEME, 0, deadline, { value: amountIn })
            const balanceAfter = await tokenOutContract.balanceOf(await signers[0].getAddress())

            expect(balanceAfter).to.be.gt(balanceBefore)
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
            const token1Contract = await ethers.getContractAt("ERC20", MEME)

            const balanceBefore = await token1Contract.balanceOf(await signers[0].getAddress())
            await expect(await swapRouter.exactInput(params, { value: amountIn })).to.emit(weth9, "Deposit")
            const balanceAfter = await token1Contract.balanceOf(await signers[0].getAddress())

            expect(balanceAfter).to.be.gt(balanceBefore)
        })

        it("MEME -> WBNB -> BNB multicall", async function () {
            const amountIn = ethers.parseUnits("1", 17)
            const MEME = position.token1
            const path = getDataHexString(MEME, await weth9.getAddress())

            const params = {
                path: path,
                recipient: ethers.ZeroAddress,
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: "0",
            }

            const token1Contract = await ethers.getContractAt("ERC20", MEME)
            await token1Contract.approve(await swapRouter.getAddress(), amountIn)

            const exactInputData = swapRouter.interface.encodeFunctionData("exactInput", [params])
            // Encode the unwrapWETH9 call to convert WETH to ETH
            const unwrapWETH9Data = swapRouter.interface.encodeFunctionData("unwrapWETH9", [
                "0",
                await signers[1].getAddress(),
            ])
            const balanceBefore = await ethers.provider.getBalance(await signers[1].getAddress())
            await expect(await swapRouter.multicall([exactInputData, unwrapWETH9Data])).to.emit(weth9, "Withdrawal")
            const balanceAfter = await ethers.provider.getBalance(await signers[1].getAddress())
            expect(balanceAfter).to.be.gt(balanceBefore)
        })

        it("WBNB -> MEME exactInput call", async () => {
            const amountIn = ethers.parseUnits("1", 17)
            const amountOutMinimum = 0 // For testing, accept any amount out
            const path = getDataHexString(await weth9.getAddress(), MEME)

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

            const token1Contract = await ethers.getContractAt("ERC20Token", MEME)

            const balanceBefore = await token1Contract.balanceOf(await signers[0].getAddress())
            await swapRouter.exactInput(params)
            const balanceAfter = await token1Contract.balanceOf(await signers[0].getAddress())

            expect(balanceAfter).to.be.gt(balanceBefore)
        })

        it("execute auto-swap", async () => {
            const amountIn = ethers.parseUnits("1", 17)
            const tx = await bnbPartyFactory.createParty(name, symbol, { value: amountIn })
            await tx.wait()
            const events = await bnbPartyFactory.queryFilter(
                bnbPartyFactory.filters["StartParty(address,address,address)"]
            )
            const tokenAddress = events[events.length - 1].args.tokenAddress
            // check liquidity pool balance
            const liquidityPoolBalance = await weth9.balanceOf(
                await v3Factory.getPool(await weth9.getAddress(), tokenAddress, FeeAmount.HIGH)
            )
            expect(liquidityPoolBalance).to.be.equal(amountIn - tokenCreationFee)
        })

        it("Should increase user tokens with excess party fee", async () => {
            const amountIn = ethers.parseUnits("1", 17)
            const tx = await bnbPartyFactory.createParty(name, symbol, { value: amountIn })
            await tx.wait()
            const events = await bnbPartyFactory.queryFilter(
                bnbPartyFactory.filters["StartParty(address,address,address)"]
            )
            const tokenAddress = events[events.length - 1].args.tokenAddress
            const token = await ethers.getContractAt("ERC20Token", tokenAddress)

            const balance = await token.balanceOf(await signers[0].getAddress())
            expect(balance).to.be.gt(0)
        })

        function getDataHexString(token0: string, token1: string) {
            return ethers.concat([
                ethers.zeroPadValue(token0, 20),
                ethers.zeroPadValue(ethers.toBeHex(FeeAmount.HIGH), 3),
                ethers.zeroPadValue(token1, 20),
            ])
        }
    })
})
