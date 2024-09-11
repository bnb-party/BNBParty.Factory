import BigNumber from "bignumber.js"

export function getPrice(sqrtPriceX96: BigNumber) {
    // Calculate price of token0 in terms of token1
    const buyOneOfToken0 = sqrtPriceX96.dividedBy(new BigNumber(2).pow(96)).pow(2)

    // Calculate price of token1 in terms of token0
    const buyOneOfToken1 = new BigNumber(1).dividedBy(buyOneOfToken0)

    // Convert to smallest unit (wei)
    const buyOneOfToken0Wei = buyOneOfToken0.multipliedBy(new BigNumber(10).pow(18)).integerValue(BigNumber.ROUND_DOWN).toString(10)
    const buyOneOfToken1Wei = buyOneOfToken1.multipliedBy(new BigNumber(10).pow(18)).integerValue(BigNumber.ROUND_DOWN).toString(10)
    
    return {
        priceToken0InToken1: buyOneOfToken0, // Price of token0 in terms of token1
        priceToken1InToken0: buyOneOfToken1, // Price of token1 in terms of token0
        priceToken0InToken1Wei: buyOneOfToken0Wei, // Price of token0 in lowest decimal (wei)
        priceToken1InToken0Wei: buyOneOfToken1Wei, // Price of token1 in lowest decimal (wei)
    }
}
