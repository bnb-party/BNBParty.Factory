import { ethers } from "hardhat"

// deploy BNBPartyFactory contract
async function main() {
    const BNBPartyFactory = await ethers.getContractFactory("BNBPartyFactory")
    // const factory = await BNBPartyFactory.deploy()

    // console.log("BNBPartyFactory deployed to:", await factory.getAddress())
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
