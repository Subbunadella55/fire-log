/**
 * PyroChain — FireAlertLogger Deployment Script
 * 
 * Usage:
 *   npx hardhat run scripts/deploy.js --network localhost
 *   npx hardhat run scripts/deploy.js --network sepolia
 */
const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║   PyroChain — Smart Contract Deployment      ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    const [deployer] = await ethers.getSigners();
    console.log(`[Deployer] Wallet:  ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`[Deployer] Balance: ${ethers.formatEther(balance)} ETH\n`);

    // The authorized backend wallet
    // In production: load from env or use deployer as default
    const backendWallet = process.env.BACKEND_WALLET_ADDRESS || deployer.address;
    console.log(`[Contract] Authorized Backend: ${backendWallet}`);

    // Deploy
    console.log('[Contract] Deploying FireAlertLogger...');
    const FireAlertLogger = await ethers.getContractFactory('FireAlertLogger');
    const contract = await FireAlertLogger.deploy(backendWallet);

    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    const txHash = contract.deploymentTransaction()?.hash;

    console.log(`\n[Contract] ✓ Deployed at: ${contractAddress}`);
    console.log(`[Contract] TX Hash:       ${txHash}`);

    // Verify deployment
    const totalAlerts = await contract.getTotalAlerts();
    console.log(`[Contract] Total alerts on-chain: ${totalAlerts}`);

    // Save deployment info
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        contractAddress,
        deployerAddress: deployer.address,
        authorizedBackend: backendWallet,
        txHash,
        deployedAt: new Date().toISOString(),
        abi: JSON.parse(fs.readFileSync(
            path.join(__dirname, '../artifacts/contracts/FireAlertLogger.sol/FireAlertLogger.json'),
            'utf8'
        )).abi,
    };

    const outPath = path.join(__dirname, '../deployment.json');
    fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n[Deploy] Info saved to: ${outPath}`);

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  NEXT STEPS:                                 ║');
    console.log('║                                              ║');
    console.log(`║  1. Copy contract address:                   ║`);
    console.log(`║     ${contractAddress.substring(0, 40)}  ║`);
    console.log(`║                                              ║`);
    console.log('║  2. Add to backend .env:                     ║');
    console.log('║     CONTRACT_ADDRESS=<address above>         ║');
    console.log('╚══════════════════════════════════════════════╝\n');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[Deploy] Error:', err);
        process.exit(1);
    });
