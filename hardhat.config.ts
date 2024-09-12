import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-verify"
import "hardhat-gas-reporter"
import "@typechain/hardhat"
import "solidity-coverage"
import "@nomicfoundation/hardhat-network-helpers"
import "@nomicfoundation/hardhat-ethers"
import "@nomicfoundation/hardhat-chai-matchers"
import "@truffle/dashboard-hardhat-plugin"

const LOW_OPTIMIZER_COMPILER_SETTINGS = {
    version: "0.7.6",
    settings: {
        evmVersion: "istanbul",
        optimizer: {
            enabled: true,
            runs: 200,
        },
        metadata: {
            bytecodeHash: "none",
        },
    },
}

const BNB_FACTORY_COMPILER_SETTINGS = {
    version: "0.8.25",
    settings: {
        evmVersion: "istanbul",
        optimizer: {
            enabled: true,
            runs: 200,
        },
    },
}

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    solidity: {
        compilers: [
            BNB_FACTORY_COMPILER_SETTINGS,
            {
                version: "0.7.6",
                settings: {
                    evmVersion: "istanbul",
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                    metadata: {
                        bytecodeHash: "none",
                    },
                },
            },
        ],
        overrides: {
            "@bnb-party/v3-periphery/contracts/NonfungiblePositionManager.sol": LOW_OPTIMIZER_COMPILER_SETTINGS,
            "@bnb-party/v3-periphery/contracts/libraries/PoolAddress.sol": LOW_OPTIMIZER_COMPILER_SETTINGS,
            "@bnb-party/v3-periphery/contracts/libraries/ChainId.sol": LOW_OPTIMIZER_COMPILER_SETTINGS,
            "@bnb-party/v3-core/contracts/libraries/TickBitmap.sol": LOW_OPTIMIZER_COMPILER_SETTINGS,
        },
    },
    networks: {
        hardhat: {
            blockGasLimit: 130_000_000,
        },
        bscTestnet: {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545",
            chainId: 97,
            //accounts: [ process.env.PRIVATE_KEY || ""],
        },
        bsc: {
            url: "https://bsc-dataseed.binance.org/",
            chainId: 56,
            //accounts: [ process.env.PRIVATE_KEY || ""],
        },
    },
    etherscan: {
        apiKey: {
            mainnet: process.env.ETHERSCAN_API_KEY || "",
            bsc: process.env.BSCSCAN_API_KEY || "",
            bscTestnet: process.env.BSCSCAN_API_KEY || "",
        },
    },
    sourcify: {
        // Disabled by default
        // Doesn't need an API key
        enabled: true,
    },
    gasReporter: {
        enabled: true,
        showMethodSig: true,
        currency: "USD",
        token: "BNB",
        gasPriceApi:
            "https://api.bscscan.com/api?module=proxy&action=eth_gasPrice&apikey=" + process.env.BSCSCAN_API_KEY,
        coinmarketcap: process.env.CMC_API_KEY || "",
        noColors: true,
        reportFormat: "markdown",
        outputFile: "gasReport.md",
        forceTerminalOutput: true,
        L1: "binance",
        forceTerminalOutputFormat: "terminal",
        showTimeSpent: true,
    },
}

export default config
