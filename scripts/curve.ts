import { ethers } from "hardhat"
import { FeeAmount, v3PartyFactory, deployContracts, weth9, bnbPartyFactory, BNBPositionManager } from "../test/helper"
import { IUniswapV3Pool } from "../typechain-types"
import BigNumber from "bignumber.js"
import * as csvWriter from "csv-writer"

const BNB_PRICE = 600 // BNB price in USD
let lpContract: IUniswapV3Pool

const createCsvWriter = csvWriter.createObjectCsvWriter
const csv = createCsvWriter({
    path: "liquidity_pool_data.csv",
    header: [
        { id: "iteration", title: "Iteration" },
        { id: "updatedMEMEAmount", title: "Updated MEME Amount" },
        { id: "updatedWBNBAmount", title: "Updated WBNB Amount" },
        { id: "updatedSqrtPriceX96", title: "Updated sqrtPriceX96" },
        { id: "priceMemeInWbnb", title: "Price of MEME in WBNB" },
        { id: "priceWbnbInMeme", title: "Price of WBNB in MEME" },
        { id: "wbnbValueInLp", title: "WBNB Value in USD" },
        { id: "memealueInLp", title: "MEME Value in USD" },
        { id: "marketCap", title: "Market Cap in USD" },
        { id: "remainingMEMEPercentage", title: "Remaining MEME %" },
    ],
})

async function createLiquidityPool() {
    const tokenCreationFee = ethers.parseUnits("1", 16)
    await bnbPartyFactory.createParty("MEME", "MEME", { value: tokenCreationFee })
    const tokenId = await BNBPositionManager.totalSupply()
    const position = await BNBPositionManager.positions(tokenId)

    const wethAddress = await weth9.getAddress()
    const MEME = position.token1 === wethAddress ? position.token0 : position.token1
    return { MEME, position }
}

function calculatePrices(sqrtPriceX96: BigNumber, token0: string, token1: string, meme: string) {
    const priceX96 = sqrtPriceX96.multipliedBy(sqrtPriceX96)
    const priceToken0InToken1 = priceX96.dividedBy(new BigNumber(2).pow(192))
    const priceToken1InToken0 = new BigNumber(1).div(priceToken0InToken1)
    // Determine which token is MEME and which is WBNB
    if (token0 === meme) {
        return {
            priceMemeInWbnb: priceToken0InToken1,
            priceWbnbInMeme: priceToken1InToken0,
        }
    } else if (token1 === meme) {
        return {
            priceMemeInWbnb: priceToken1InToken0,
            priceWbnbInMeme: priceToken0InToken1,
        }
    } else {
        throw new Error("MEME token address does not match either token0 or token1 in the pool")
    }
}

async function getTokenBalances(lpAddress: string, token: any) {
    const [fullMEMEAmount, fullWBNBAmount, wethAddress] = await Promise.all([
        token.balanceOf(lpAddress),
        weth9.balanceOf(lpAddress),
        weth9.getAddress(),
    ])

    const lpPool = await ethers.getContractAt("UniswapV3Pool", lpAddress)
    const [feeGrowthGlobal0X128, feeGrowthGlobal1X128, liquidity, getFeeGlobal] = await Promise.all([
        lpPool.feeGrowthGlobal0X128(),
        lpPool.feeGrowthGlobal1X128(),
        lpPool.liquidity(),
        bnbPartyFactory.getFeeGrowthInsideLastX128(lpAddress),
    ])
    const token0 = await lpPool.token0()
    const token1 = await lpPool.token1()

    const isToken0WBNB = token0 === wethAddress
    const isToken1WBNB = token1 === wethAddress

    const [wbnbFee, memeFee] = await Promise.all([
        isToken0WBNB
            ? bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobal0X128 - getFeeGlobal.feeGrowthInside0LastX128)
            : bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobal1X128 - getFeeGlobal.feeGrowthInside1LastX128),
        isToken1WBNB
            ? bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobal0X128 - getFeeGlobal.feeGrowthInside0LastX128)
            : bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobal1X128 - getFeeGlobal.feeGrowthInside1LastX128),
    ])

    return { WBNBAmount: fullWBNBAmount - wbnbFee, MEMEAmount: fullMEMEAmount - memeFee }
}

async function test() {
    await deployContracts()
    const { MEME, position } = await createLiquidityPool()
    const token = await ethers.getContractAt("ERC20Token", MEME)
    const lpAddress = await v3PartyFactory.getPool(position.token0, position.token1, FeeAmount.HIGH)

    const { MEMEAmount } = await getTokenBalances(lpAddress, token)
    const initialMEMEAmount = MEMEAmount // Save the initial MEME amount for later comparison
    lpContract = (await ethers.getContractAt("UniswapV3Pool", lpAddress)) as any as IUniswapV3Pool
    const [token0, token1] = await Promise.all([lpContract.token0(), lpContract.token1()])

    const target = 26
    for (let i = 0; i < target; i++) {
        const swapAmount = ethers.parseUnits("5", 17)
        await bnbPartyFactory.joinParty(MEME, 0, { value: swapAmount })
        const { MEMEAmount, WBNBAmount } = await getTokenBalances(lpAddress, token)
        const updatedSlot0 = await lpContract.slot0()

        const updatedSqrtPriceX96 = new BigNumber(updatedSlot0.sqrtPriceX96.toString())
        const { priceMemeInWbnb: updatedPriceMemeInWbnb, priceWbnbInMeme: updatedPriceWbnbInMeme } = calculatePrices(
            updatedSqrtPriceX96,
            token0,
            token1,
            MEME
        )

        // Calculate market cap
        const wbnbValueUSD = new BigNumber(WBNBAmount.toString()).div(new BigNumber(10).pow(18)).multipliedBy(BNB_PRICE)
        const memeAmountInWbnb = new BigNumber(initialMEMEAmount.toString()).div(new BigNumber(10).pow(18)).multipliedBy(updatedPriceMemeInWbnb)
        const memeValueUSD = new BigNumber(MEMEAmount.toString()).div(new BigNumber(10).pow(18)).multipliedBy(updatedPriceMemeInWbnb).multipliedBy(BNB_PRICE)
        const marketCap = memeAmountInWbnb.multipliedBy(BNB_PRICE)

        // Calculate the remaining percentage of MEME tokens
        const remainingMEMEPercentage = new BigNumber(MEMEAmount.toString()).dividedBy(new BigNumber(initialMEMEAmount.toString())).multipliedBy(100).toFixed(2)

        // Prepare data for logging
        const data = [
            {
                iteration: i + 1,
                updatedMEMEAmount: MEMEAmount.toString(),
                updatedWBNBAmount: WBNBAmount.toString(),
                updatedSqrtPriceX96: updatedSqrtPriceX96.toString(),
                priceMemeInWbnb: updatedPriceMemeInWbnb.toString(),
                priceWbnbInMeme: updatedPriceWbnbInMeme.toString(),
                wbnbValueInLp: wbnbValueUSD.toString(),
                memealueInLp: memeValueUSD.toString(),
                marketCap: marketCap.toString(),
                remainingMEMEPercentage: remainingMEMEPercentage,
            },
        ]
        console.log(data)

        // Write data to CSV
        await csv.writeRecords(data)
    }
}

test().catch(console.error)
