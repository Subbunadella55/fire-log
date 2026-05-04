require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: '0.8.19',
        settings: {
            optimizer: { enabled: true, runs: 200 },
        },
    },
    networks: {
        // Local Hardhat node (for development)
        localhost: {
            url: 'http://127.0.0.1:8545',
            chainId: 31337,
        },
        // Ethereum Sepolia Testnet
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || '',
            accounts: process.env.DEPLOYER_PRIVATE_KEY
                ? [process.env.DEPLOYER_PRIVATE_KEY]
                : [],
            chainId: 11155111,
        },
        // Polygon Mumbai Testnet
        mumbai: {
            url: process.env.MUMBAI_RPC_URL || '',
            accounts: process.env.DEPLOYER_PRIVATE_KEY
                ? [process.env.DEPLOYER_PRIVATE_KEY]
                : [],
            chainId: 80001,
        },
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY || '',
    },
    paths: {
        sources: './contracts',
        tests: './test',
        cache: './cache',
        artifacts: './artifacts',
    },
};
