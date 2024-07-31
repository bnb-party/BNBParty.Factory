import { ethers } from "hardhat"

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
