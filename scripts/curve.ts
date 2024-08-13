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
        { id: "updatedLiquidity", title: "Updated Liquidity" },
        { id: "updatedSqrtPriceX96", title: "Updated sqrtPriceX96" },
        { id: "priceMemeInWbnb", title: "Price of MEME in WBNB" },
        { id: "priceWbnbInMeme", title: "Price of WBNB in MEME" },
        { id: "wbnbValueUSD", title: "WBNB Value in USD" },
        { id: "memeValueUSD", title: "MEME Value in USD" },
        { id: "marketCap", title: "Market Cap in USD" },
        { id: "remainingMEMEPercentage", title: "Remaining MEME %" },
    ],
})

async function before() {
    await deployContracts()
}

async function createLiquidityPool() {
    const tokenCreationFee = ethers.parseUnits("1", 16)
    await bnbPartyFactory.createParty("MEME", "MEME", { value: tokenCreationFee })
    const tokenId = await BNBPositionManager.totalSupply()
    const position = await BNBPositionManager.positions(tokenId)
    const MEME = position.token1 === (await weth9.getAddress()) ? position.token0 : position.token1
    return { MEME, position }
}

async function getPoolData(lpContract: IUniswapV3Pool) {
    const slot0 = await lpContract.slot0()
    const liquidity = await lpContract.liquidity()
    console.log("Liquidity: ", liquidity.toString())
    return { slot0, liquidity }
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

async function logPrices(meme: string, token0: string, token1: string, sqrtPriceX96: BigNumber) {
    const { priceMemeInWbnb, priceWbnbInMeme } = calculatePrices(sqrtPriceX96, token0, token1, meme)
    console.log(`Price of MEME in terms of WBNB: ${priceMemeInWbnb.toString()}`)
    console.log(`Price of WBNB in terms of MEME: ${priceWbnbInMeme.toString()}`)
}

async function getTokenBalances(lpAddress: string, token: any) {
    const fullMEMEAmount = await token.balanceOf(lpAddress)
    const fullWBNBAmount = await weth9.balanceOf(lpAddress)
    const lpPool = await ethers.getContractAt("UniswapV3Pool", lpAddress)
    let feeGrowthGlobal0X128 = await lpPool.feeGrowthGlobal0X128()
    let feeGrowthGlobal1X128 = await lpPool.feeGrowthGlobal1X128()
    let liquidity = await lpPool.liquidity()
    let getFeeGlobal = await bnbPartyFactory.getFeeGrowthInsideLastX128(lpAddress)
    let wbnbFee
    let memeFee
    if ((await lpPool.token0()) === (await weth9.getAddress())) {
        wbnbFee = await bnbPartyFactory.calculateFees(
            liquidity,
            feeGrowthGlobal0X128 - getFeeGlobal.feeGrowthInside0LastX128
        )
        memeFee = await bnbPartyFactory.calculateFees(
            liquidity,
            feeGrowthGlobal1X128 - getFeeGlobal.feeGrowthInside1LastX128
        )
        console.log("WBNB fee: ", wbnbFee)
        console.log("MEME fee: ", memeFee)
        console.log("WBNB amount: ", fullWBNBAmount - wbnbFee)
        console.log("MEME amount: ", fullMEMEAmount - memeFee)
    } else {
        wbnbFee = await bnbPartyFactory.calculateFees(
            liquidity,
            feeGrowthGlobal1X128 - getFeeGlobal.feeGrowthInside1LastX128
        )
        memeFee = await bnbPartyFactory.calculateFees(
            liquidity,
            feeGrowthGlobal0X128 - getFeeGlobal.feeGrowthInside0LastX128
        )
        console.log("WBNB fee: ", wbnbFee)
        console.log("MEME fee: ", memeFee)
        console.log("WBNB amount: ", fullWBNBAmount - wbnbFee)
        console.log("MEME amount: ", fullMEMEAmount - memeFee)
    }

    return { WBNBAmount: fullWBNBAmount - wbnbFee, MEMEAmount: fullMEMEAmount - memeFee }
}

async function test() {
    await before()
    const { MEME, position } = await createLiquidityPool()
    const token = await ethers.getContractAt("ERC20Token", MEME)
    const lpAddress = await v3PartyFactory.getPool(position.token0, position.token1, FeeAmount.HIGH)

    const { MEMEAmount, WBNBAmount } = await getTokenBalances(lpAddress, token)
    const initialMEMEAmount = MEMEAmount // Save the initial MEME amount for later comparison
    lpContract = (await ethers.getContractAt("UniswapV3Pool", lpAddress)) as any as IUniswapV3Pool
    const { slot0, liquidity } = await getPoolData(lpContract)

    const sqrtPriceX96 = new BigNumber(slot0.sqrtPriceX96.toString())
    const token0 = await lpContract.token0()
    const token1 = await lpContract.token1()

    await logPrices(MEME, token0, token1, sqrtPriceX96)

    const target = 13
    for (let i = 0; i < target; i++) {
        const swapAmount = ethers.parseUnits("1", 18)
        await bnbPartyFactory.joinParty(MEME, 0, { value: swapAmount })
        const { MEMEAmount, WBNBAmount } = await getTokenBalances(lpAddress, token)
        console.log("Updated MEME amount: ", MEMEAmount.toString())
        console.log("Updated WBNB amount: ", WBNBAmount.toString())
        const updatedSlot0 = await lpContract.slot0()
        const updatedLiquidity = await lpContract.liquidity()
        console.log("Updated liquidity: ", updatedLiquidity.toString())

        const updatedSqrtPriceX96 = new BigNumber(updatedSlot0.sqrtPriceX96.toString())
        const { priceMemeInWbnb: updatedPriceMemeInWbnb, priceWbnbInMeme: updatedPriceWbnbInMeme } = calculatePrices(
            updatedSqrtPriceX96,
            token0,
            token1,
            MEME
        )

        console.log(`Updated sqrtPriceX96: ${updatedSqrtPriceX96.toString()}`)

        if (!(updatedLiquidity == 0n)) {
            await logPrices(MEME, token0, token1, updatedSqrtPriceX96)

            // Calculate market cap
            const wbnbValueUSD = new BigNumber(WBNBAmount.toString()).div(new BigNumber(10).pow(18)).multipliedBy(BNB_PRICE)
            console.log(`WBNB Value in Liquidity pool: ${wbnbValueUSD.toString()}`)

            const memeAmountInWbnb = new BigNumber(initialMEMEAmount.toString()).dividedBy(new BigNumber(10).pow(18)).multipliedBy(updatedPriceMemeInWbnb)
            const marketCap = memeAmountInWbnb.multipliedBy(BNB_PRICE)

            console.log(`MEME Market Cap: ${marketCap.toString()}`)

            // Calculate the remaining percentage of MEME tokens
            const remainingMEMEPercentage = new BigNumber(MEMEAmount.toString()).dividedBy(new BigNumber(initialMEMEAmount.toString())).multipliedBy(100).toFixed(2)
            console.log(`Remaining MEME tokens in the pool: ${remainingMEMEPercentage}%\n`)

            // Write data to CSV
            await csv.writeRecords([
                {
                    iteration: i + 1,
                    updatedMEMEAmount: MEMEAmount.toString(),
                    updatedWBNBAmount: WBNBAmount.toString(),
                    updatedLiquidity: updatedLiquidity.toString(),
                    updatedSqrtPriceX96: updatedSqrtPriceX96.toString(),
                    priceMemeInWbnb: updatedPriceMemeInWbnb.toString(),
                    priceWbnbInMeme: updatedPriceWbnbInMeme.toString(),
                    wbnbValueUSD: updatedPriceWbnbInMeme.multipliedBy(BNB_PRICE).toString(),
                    memeValueUSD: updatedPriceMemeInWbnb.multipliedBy(BNB_PRICE).toString(),
                    marketCap: marketCap.toString(),
                    remainingMEMEPercentage: remainingMEMEPercentage,
                },
            ])
        } else {
            console.log("Updated price of MEME in terms of WBNB: not available (liquidity is zero)")
            console.log("Updated price of WBNB in terms of MEME: not available (liquidity is zero)")
        }
    }
}

test().catch(console.error)
