import BigNumber from "bignumber.js" // Import BigNumber.js for precise calculations

// Configure BigNumber.js for high precision
BigNumber.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

// Function to calculate sqrtPriceX96
export function encodePriceSqrt(reserve1: string, reserve0: string): bigint {
    return BigInt(
        new BigNumber(reserve1) // Convert reserve1 to a BigNumber
            .div(reserve0) // Divide by reserve0
            .sqrt() // Take the square root of the result
            .multipliedBy(new BigNumber(2).pow(96)) // Multiply by 2^96
            .integerValue(BigNumber.ROUND_DOWN) // Round down to the nearest integer
            .toString() // Convert to string
    )
}
