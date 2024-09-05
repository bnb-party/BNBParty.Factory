import { ethers } from "hardhat"
import { FeeAmount, v3PartyFactory, deployContracts, bnbPartyFactory, BNBPositionManager, v3Factory, positionManager, maxAndMinWBNB } from "../test/helper"
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
        { id: "MEMEAmount", title: "MEME Amount" },
        { id: "WBNBAmount", title: "WBNB Amount" },
        { id: "SqrtPriceX96", title: "sqrtPriceX96" },
        { id: "priceMemeInWbnb", title: "Price of MEME in WBNB" },
        { id: "priceWbnbInMeme", title: "Price of WBNB in MEME" },
        { id: "wbnbValueInLp", title: "WBNB Value in USD" },
        { id: "memeValueInLp", title: "MEME Value in USD" },
        { id: "marketCap", title: "Market Cap in USD" },
        { id: "memeMarketCapInBnb", title: "Market Cap in BNB" },
        { id: "remainingMEMEPercentage", title: "Remaining MEME %" },
    ],
})

async function createLiquidityPool(wethAddress: string) {
    const tokenCreationFee = ethers.parseUnits("1", 16)
    await bnbPartyFactory.createParty("MEME", "MEME", { value: tokenCreationFee })
    const tokenId = await BNBPositionManager.totalSupply()
    const position = await BNBPositionManager.positions(tokenId)

    const MEME = position.token1 === wethAddress ? position.token0 : position.token1
    return { MEME, position }
}

function calculatePrices(sqrtPriceX96: BigNumber, token0: string, token1: string, meme: string) {
    const priceX96 = sqrtPriceX96.pow(2)
    const priceToken0InToken1 = priceX96.dividedBy(new BigNumber(2).pow(192))
    const priceToken1InToken0 = new BigNumber(1).div(priceToken0InToken1)
    return token0 === meme
        ? { priceMemeInWbnb: priceToken0InToken1, priceWbnbInMeme: priceToken1InToken0 }
        : { priceMemeInWbnb: priceToken1InToken0, priceWbnbInMeme: priceToken0InToken1 }
}

async function getTokenBalances(lpAddress: string, token: any, weth9Address: string) {
    const weth9 = await ethers.getContractAt("IWBNB", weth9Address)
    const [MEMEAmount, WBNBAmount, wethAddress] = await Promise.all([
        token.balanceOf(lpAddress),
        weth9.balanceOf(lpAddress),
        weth9.getAddress(),
    ])

    const lpPool = await ethers.getContractAt("UniswapV3Pool", lpAddress)
    const token0 = await lpPool.token0()
    const isPartyPool = await bnbPartyFactory.isTokenOnPartyLP(token0 === wethAddress ? await token.getAddress() : token0)
    const [feeGrowthGlobal0X128, feeGrowthGlobal1X128, liquidity, getFeeGlobal] = await Promise.all([
        lpPool.feeGrowthGlobal0X128(),
        lpPool.feeGrowthGlobal1X128(),
        lpPool.liquidity(),
        bnbPartyFactory.getFeeGrowthInsideLastX128(lpAddress, isPartyPool ? BNBPositionManager : positionManager),
    ])
    let wbnbFee, memeFee
    if (token0 === wethAddress) {
        wbnbFee = await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobal0X128 - getFeeGlobal.feeGrowthInside0LastX128)
        memeFee = await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobal1X128 - getFeeGlobal.feeGrowthInside1LastX128)
    } else {
        memeFee = await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobal0X128 - getFeeGlobal.feeGrowthInside0LastX128)
        wbnbFee = await bnbPartyFactory.calculateFees(liquidity, feeGrowthGlobal1X128 - getFeeGlobal.feeGrowthInside1LastX128)
    }

    return { WBNBAmount: new BigNumber((WBNBAmount - wbnbFee).toString()), MEMEAmount: new BigNumber((MEMEAmount - memeFee).toString()) }
}

async function logData(
    iteration: number,
    MEMEAmount: BigNumber,
    WBNBAmount: BigNumber,
    sqrtPriceX96: BigNumber,
    priceMemeInWbnb: BigNumber,
    priceWbnbInMeme: BigNumber,
    initialMEMEAmount: BigNumber
) {
    const wbnbValueUSD = WBNBAmount.div(new BigNumber(10).pow(18)).multipliedBy(BNB_PRICE)
    const memeValueUSD = MEMEAmount.div(new BigNumber(10).pow(18)).multipliedBy(priceMemeInWbnb).multipliedBy(BNB_PRICE)
    const marketCap = initialMEMEAmount.div(new BigNumber(10).pow(18)).multipliedBy(priceMemeInWbnb).multipliedBy(BNB_PRICE)
    const remainingMEMEPercentage = MEMEAmount.div(initialMEMEAmount).multipliedBy(100).toFixed(2)
    const memeMarketCapInBnb = initialMEMEAmount.div(new BigNumber(10).pow(18)).multipliedBy(priceMemeInWbnb)

    const data = {
        iteration,
        MEMEAmount: MEMEAmount.toString(),
        WBNBAmount: WBNBAmount.toString(),
        SqrtPriceX96: sqrtPriceX96.toString(),
        priceMemeInWbnb: priceMemeInWbnb.toString(),
        priceWbnbInMeme: priceWbnbInMeme.toString(),
        wbnbValueInLp: wbnbValueUSD.toString(),
        memeValueInLp: memeValueUSD.toString(),
        marketCap: marketCap.toString(),
        memeMarketCapInBnb: memeMarketCapInBnb.toString(),
        remainingMEMEPercentage,
    }

    console.log(data)
    await csv.writeRecords([data])
}

async function test() {
    const target = ethers.parseEther("13")
    const wbnbAddresses = await maxAndMinWBNB()
    await deployContracts(target, wbnbAddresses.maxAddress)
    const { MEME, position } = await createLiquidityPool(wbnbAddresses.maxAddress)
    const token = await ethers.getContractAt("ERC20Token", MEME)
    const lpAddress = await v3PartyFactory.getPool(position.token0, position.token1, FeeAmount.HIGH)
    lpContract = (await ethers.getContractAt("UniswapV3Pool", lpAddress)) as any as IUniswapV3Pool

    const { MEMEAmount: initialMEMEAmount,  } = await getTokenBalances(lpAddress, token, wbnbAddresses.maxAddress)
    const segments = 26
    for (let i = 0; i <= segments; ++i) {
        const swapAmount = ethers.parseUnits("5.06", 17)
        if( i !== 0) await bnbPartyFactory.joinParty(MEME, 0, { value: swapAmount })
        const isParty = await bnbPartyFactory.isTokenOnPartyLP(MEME)
        if (isParty) {
            const { MEMEAmount, WBNBAmount } = await getTokenBalances(lpAddress, token, wbnbAddresses.maxAddress)
            const slot0 = await lpContract.slot0()
            const sqrtPriceX96 = new BigNumber(slot0.sqrtPriceX96.toString())
            const { priceMemeInWbnb, priceWbnbInMeme } = calculatePrices(sqrtPriceX96, await lpContract.token0(), await lpContract.token1(), MEME)
            await logData(i, MEMEAmount, WBNBAmount, sqrtPriceX96, priceMemeInWbnb, priceWbnbInMeme, initialMEMEAmount)
        }
        else { 
            const newLPPool = await v3Factory.getPool(wbnbAddresses.maxAddress, MEME, FeeAmount.HIGH)
            const lpContract = (await ethers.getContractAt("UniswapV3Pool", newLPPool)) as any as IUniswapV3Pool
            const slot0 = await lpContract.slot0()
            const sqrtPriceX96 = new BigNumber(slot0.sqrtPriceX96.toString())
            const { priceMemeInWbnb, priceWbnbInMeme } = calculatePrices(sqrtPriceX96, await lpContract.token0(), await lpContract.token1(), MEME)
            const { MEMEAmount, WBNBAmount } = await getTokenBalances(newLPPool, token, wbnbAddresses.maxAddress)
            await logData(i, MEMEAmount, WBNBAmount, sqrtPriceX96, priceMemeInWbnb, priceWbnbInMeme, initialMEMEAmount)
        }
    }
}

test().catch(console.error)
