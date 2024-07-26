import { ethers } from "hardhat"

enum FeeAmount {
    LOW = 500,
    MEDIUM = 3000,
    HIGH = 10000,
}

// deploy BNBPartyFactory contract
async function main() {
    const partyTarget = ethers.parseEther("1.1")
    const tokenCreationFee = ethers.parseUnits("1", 16)
    const returnFeeAmount = ethers.parseUnits("2", 16)
    const bonusFee = ethers.parseUnits("1", 17)
    const initialTokenAmount = "10000000000000000000000000"
    const sqrtPriceX96 = "25052911542910170730777872"
    const targetReachFee = ethers.parseUnits("1", 17)
    const tWBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"
    const pancakeSwapManager = "0x427bF5b37357632377eCbEC9de3626C71A5396c1"

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
            targetReachFee: targetReachFee,
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
    let tx = await bnbPartyFactory.setNonfungiblePositionManager(await positionManager.getAddress(), pancakeSwapManager)
    await tx.wait()
    console.log("PositionManager set to BNBPartyFactory")
    // set swapRouter
    tx = await bnbPartyFactory.setSwapRouter(await swapRouter.getAddress())
    await tx.wait()
    console.log("SwapRouter set to BNBPartyFactory")
    const name = "Party"
    const symbol = "Token"
    tx = await bnbPartyFactory.createParty(name, symbol, { value: tokenCreationFee })
    await tx.wait()
    console.log("Party created")
    // auto-swap
    tx = await bnbPartyFactory.createParty(name, symbol, {
        value: tokenCreationFee + 10000000000000n,
        gasPrice: ethers.parseUnits("6", "gwei"),
        gasLimit: 50_000_000,
    })
    await tx.wait()
    console.log("auto-swap party created")
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
