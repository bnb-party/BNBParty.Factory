import { BNBPartyFactory } from "../typechain-types/contracts/BNBPartyFactory"
import { expect } from "chai"
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { time } from "@nomicfoundation/hardhat-network-helpers"

describe("BNBPartyFactory", function () {
    before(async () => {
        const BNBPartyFactory = await ethers.getContractFactory("BNBPartyFactory")
    })

    beforeEach(async () => {})

    it("should return name of contract", async () => {})
})
