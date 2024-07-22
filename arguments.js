// for bnb-party verification

const partyTarget = ethers.parseEther("100")
const tokenCreationFee = ethers.parseUnits("1", 16)
const returnFeeAmount = ethers.parseUnits("1", 16)
const bonusFee = ethers.parseUnits("1", 16)
const initialTokenAmount = "10000000000000000000000000"
const sqrtPriceX96 = "25052911542910170730777872"
const tWBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"
module.exports = [
    {
        partyTarget: partyTarget,
        createTokenFee: tokenCreationFee,
        partyLpFee: 10000,
        lpFee: 10000,
        initialTokenAmount: initialTokenAmount,
        sqrtPriceX96: sqrtPriceX96,
        bonusTargetReach: returnFeeAmount,
        bonusPartyCreator: bonusFee,
        tickLower: "-92200",
        tickUpper: "0",
    },
    tWBNB,
]
