import { expect } from "chai"
import { ethers } from "hardhat"
import { IWBNB } from "../typechain-types/contracts/interfaces/IWBNB"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { BNBPartyFactory } from "../typechain-types/contracts/BNBPartyFactory"
import { ERC20, IUniswapV3Pool } from "../typechain-types"
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

    before(async () => {
        signers = await ethers.getSigners()
        await deployContracts()
    })

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
        expect(await BNBPositionManager.totalSupply()).to.equal(1)
    })

    it("bnb-party is owner of the party LP", async () => {
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        const tokenId = (await BNBPositionManager.totalSupply()) - 1n
        const owner = await BNBPositionManager.ownerOf(tokenId)
        expect(owner).to.equal(await bnbPartyFactory.getAddress())
    })

    it("should pay fee for token and lp creation", async function () {
        const balanceBefore = await ethers.provider.getBalance(await bnbPartyFactory.getAddress())
        await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        const balanceAfter = await ethers.provider.getBalance(await bnbPartyFactory.getAddress())
        expect(balanceAfter).to.be.equal(balanceBefore + tokenCreationFee)
    })

    it("should revert if not enough BNB is sent", async function () {
        await expect(
            bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee - 1n })
        ).to.be.revertedWithCustomError(bnbPartyFactory, "InsufficientBNB")
    })

    it("should revert to Create Party if position manager is not set", async function () {
        await bnbPartyFactory.setNonfungiblePositionManager(ethers.ZeroAddress, ethers.ZeroAddress)
        await expect(
            bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
        ).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroAddress")
        await bnbPartyFactory.setNonfungiblePositionManager(
            await BNBPositionManager.getAddress(),
            await positionManager.getAddress()
        )
    })

    it("should revert if swap router is not set", async function () {
        const amountIn = ethers.parseUnits("1", 18)
        await bnbPartyFactory.setSwapRouter(ethers.ZeroAddress)
        await expect(bnbPartyFactory.createParty(name, symbol, { value: amountIn })).to.be.revertedWithCustomError(
            bnbPartyFactory,
            "ZeroAddress"
        )
        await bnbPartyFactory.setSwapRouter(await BNBSwapRouter.getAddress())
    })

    describe("Smart Router", function () {
        let tokenId: string
        let deadline: number
        let position: any
        let MEME: string
        let lpAddress: string
        let MEMEToken: ERC20

        before(async () => {
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
            const MEME = position.token1
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
            const events = await bnbPartyFactory.queryFilter(
                bnbPartyFactory.filters["StartParty(address,address,address)"]
            )
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
            const events = await bnbPartyFactory.queryFilter(
                bnbPartyFactory.filters["StartParty(address,address,address)"]
            )
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
            await expect(bnbPartyFactory.joinParty(MEME, 0)).to.be.revertedWithCustomError(
                bnbPartyFactory,
                "ZeroAmount"
            )
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

    describe("Second Liquidity Pool", function () {
        let MEME: string
        let tokenId: string
        let position: any

        beforeEach(async () => {
            await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
            tokenId = ((await BNBPositionManager.totalSupply()) - 1n).toString()
            position = await BNBPositionManager.positions(tokenId)
            MEME = position.token1 == (await weth9.getAddress()) ? position.token0 : position.token1
        })

        it("should create second liquidity pool", async () => {
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
            expect(await positionManager.totalSupply()).to.equal(1)
        })

        it("bnb-party is owner of the second LP", async () => {
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
            const tokenId = (await positionManager.totalSupply()) - 1n
            expect(await positionManager.ownerOf(tokenId)).to.equal(await bnbPartyFactory.getAddress())
        })

        it("should send bonus to party creator", async () => {
            const balanceBefore = await ethers.provider.getBalance(await signers[0].getAddress())
            await bnbPartyFactory.connect(signers[1]).joinParty(MEME, 0, { value: BNBToTarget })
            const balanceAfter = await ethers.provider.getBalance(await signers[0].getAddress())
            expect(balanceAfter).to.be.equal(balanceBefore + bonusFee)
        })

        it("should send MEME to new LP", async () => {
            const token = await ethers.getContractAt("ERC20Token", MEME)
            const oldLPPool = await v3PartyFactory.getPool(await weth9.getAddress(), MEME, FeeAmount.HIGH)
            const oldBalance = await token.balanceOf(oldLPPool)
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
            const newLPPool = await v3Factory.getPool(await weth9.getAddress(), MEME, FeeAmount.HIGH)
            const newBalance = await token.balanceOf(newLPPool)
            const userBalance = await token.balanceOf(await signers[0].getAddress())
            const bnbpartyBalance = await token.balanceOf(await bnbPartyFactory.getAddress())
            expect(newBalance).to.be.equal(oldBalance - userBalance - bnbpartyBalance - 1n)
        })

        it("should send WBNB to new LP", async () => {
            await bnbPartyFactory.joinParty(MEME, 0, { value: BNBToTarget })
            const lpAddress = await v3Factory.getPool(await weth9.getAddress(), MEME, FeeAmount.HIGH)
            const balance = await weth9.balanceOf(lpAddress)
            const percentFee = ethers.parseEther("0.91")
            expect(balance).to.be.equal(BNBToTarget - returnFeeAmount - bonusFee - targetReachFee - percentFee - 1n)
        })
    })

    describe("Withdraw fees", function () {
        let MEME: string
        let tokenId: string
        let position: any
        const amountIn = ethers.parseUnits("1", 18)
        let lpAddress: string

        beforeEach(async () => {
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
            expect(await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobalX128)).to.be.equal(
                amountIn / 100n - 1n
            ) // 1 % fee
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
            console.log(collectedFee.feeGrowthInside0LastX128)
            expect(await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobalX128 - collectedFee.feeGrowthInside0LastX128)).to.be.equal(0)
        })

        it("should revert zero lenght array", async () => {
            await expect(bnbPartyFactory.withdrawLPFee([])).to.be.revertedWithCustomError(bnbPartyFactory, "ZeroLength")
        })
    })
})

function getDataHexString(token0: string, token1: string) {
    return ethers.concat([
        ethers.zeroPadValue(token0, 20),
        ethers.zeroPadValue(ethers.toBeHex(FeeAmount.HIGH), 3),
        ethers.zeroPadValue(token1, 20),
    ])
}
