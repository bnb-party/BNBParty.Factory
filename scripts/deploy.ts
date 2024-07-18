import { ethers } from "hardhat"

enum FeeAmount {
    LOW = 500,
    MEDIUM = 3000,
    HIGH = 10000,
}

// deploy BNBPartyFactory contract
async function main() {
    const partyTarget = ethers.parseEther("100")
    const tokenCreationFee = ethers.parseUnits("1", 16)
    const returnFeeAmount = ethers.parseUnits("1", 16)
    const bonusFee = ethers.parseUnits("1", 16)
    const initialTokenAmount = "10000000000000000000000000"
    const sqrtPriceX96 = "25052911542910170730777872"
    const tWBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"

    const BNBPartyFactoryContract = await ethers.getContractFactory("BNBPartyFactory")
    const bnbPartyFactory = await BNBPartyFactoryContract.deploy(
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
        tWBNB
    )
    console.log("BNBPartyFactory deployed to:", await bnbPartyFactory.getAddress())

    const V3FactoryContract = await ethers.getContractFactory("UniswapV3Factory")
    const v3Factory = await V3FactoryContract.deploy(await bnbPartyFactory.getAddress())
    console.log("V3Factory deployed to:", await v3Factory.getAddress())

    const TokenPositionDescriptor = await ethers.getContractFactory("MockNonfungibleTokenPositionDescriptor")
    const tokenPositionDescriptor = await TokenPositionDescriptor.deploy()
    console.log("TokenPositionDescriptor deployed to:", await tokenPositionDescriptor.getAddress())
    // deploy positionManager
    const PositionManagerContract = await ethers.getContractFactory("NonfungiblePositionManager")
    const positionManager = await PositionManagerContract.deploy(
        await v3Factory.getAddress(),
        tWBNB,
        await tokenPositionDescriptor.getAddress()
    )
    console.log("PositionManager deployed to:", await positionManager.getAddress())

    //deploy swapRouter
    const SwapRouterContract = await ethers.getContractFactory("SwapRouter")
    const swapRouter = await SwapRouterContract.deploy(await v3Factory.getAddress(), tWBNB)
    console.log("SwapRouter deployed to:", await swapRouter.getAddress())

    // set positionManager
    await bnbPartyFactory.setNonfungiblePositionManager(
        await positionManager.getAddress(),
        await positionManager.getAddress()
    )

    const name = "Party"
    const symbol = "Token"
    await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
