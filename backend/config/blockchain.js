/**
 * PyroChain - Blockchain Service
 * Handles interaction with the FireAlertLogger smart contract via ethers.js
 */
require('dotenv').config();
const { ethers } = require('ethers');

// ── ABI (key functions only — generated from FireAlertLogger.sol) ────────────
const CONTRACT_ABI = [
    "function logAlert(string calldata _deviceId, int16 _temperature, uint16 _humidity, uint16 _smokeLevel, uint8 _severity, string calldata _location, int32 _latitude, int32 _longitude, uint256 _timestamp) external returns (uint256 alertId)",
    "function resolveAlert(uint256 _alertId) external",
    "function getAlert(uint256 _alertId) external view returns (tuple(string deviceId, int16 temperature, uint16 humidity, uint16 smokeLevel, uint8 severity, string location, int32 latitude, int32 longitude, uint256 timestamp, bool resolved, address loggedBy))",
    "function getAllAlerts() external view returns (tuple(string deviceId, int16 temperature, uint16 humidity, uint16 smokeLevel, uint8 severity, string location, int32 latitude, int32 longitude, uint256 timestamp, bool resolved, address loggedBy)[])",
    "function getAlertsPaginated(uint256 _offset, uint256 _limit) external view returns (tuple(string deviceId, int16 temperature, uint16 humidity, uint16 smokeLevel, uint8 severity, string location, int32 latitude, int32 longitude, uint256 timestamp, bool resolved, address loggedBy)[] result, uint256 total)",
    "function getTotalAlerts() external view returns (uint256)",
    "event AlertLogged(uint256 indexed alertId, string indexed deviceId, uint8 indexed severity, uint256 timestamp, string location)",
    "event AlertResolved(uint256 indexed alertId, string indexed deviceId, uint256 resolvedAt)"
];

// Severity string → numeric mapping
const SEVERITY_MAP = {
    'NORMAL': 0,
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3,
    'CRITICAL': 4,
};

class BlockchainService {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.contract = null;
        this.isReady = false;
    }

    /**
     * Initialize provider, wallet, and contract instance.
     * Call this once during server startup.
     */
    async init() {
        try {
            const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
            const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
            const contractAddr = process.env.CONTRACT_ADDRESS;

            if (!rpcUrl || !privateKey || !contractAddr || contractAddr === '0x0000000000000000000000000000000000000000') {
                console.warn('[Blockchain] Contract address not set — blockchain logging disabled.');
                return false;
            }

            this.provider = new ethers.JsonRpcProvider(rpcUrl);
            this.wallet = new ethers.Wallet(privateKey, this.provider);
            this.contract = new ethers.Contract(contractAddr, CONTRACT_ABI, this.wallet);

            // Sanity check: verify network connection
            const network = await this.provider.getNetwork();
            console.log(`[Blockchain] Connected to network: ${network.name} (chainId: ${network.chainId})`);
            console.log(`[Blockchain] Backend wallet: ${this.wallet.address}`);

            this.isReady = true;
            return true;
        } catch (err) {
            console.error('[Blockchain] Init error:', err.message);
            this.isReady = false;
            return false;
        }
    }

    /**
     * Log a fire alert to the blockchain.
     * @param {Object} alertData - Processed alert data from the backend.
     * @returns {{ txHash: string, alertId: number, blockNumber: number } | null}
     */
    async logAlert(alertData) {
        if (!this.isReady) {
            console.warn('[Blockchain] Service not ready — skipping blockchain log.');
            return null;
        }

        try {
            const severityNum = SEVERITY_MAP[alertData.severity] ?? 0;
            const tempInt = Math.round(alertData.temperature * 10); // e.g. 55.5 → 555
            const humidityInt = Math.round(alertData.humidity * 10);    // e.g. 72.5 → 725
            const latInt = Math.round(alertData.latitude * 1e6);
            const lonInt = Math.round(alertData.longitude * 1e6);
            const timestamp = Math.floor(new Date(alertData.sensorTimestamp).getTime() / 1000);

            console.log('[Blockchain] Submitting transaction...');

            const tx = await this.contract.logAlert(
                alertData.deviceId,
                tempInt,
                humidityInt,
                Math.min(alertData.smokeLevel, 1023),
                severityNum,
                alertData.location,
                latInt,
                lonInt,
                timestamp,
                {
                    gasLimit: 300000, // Safe upper bound
                }
            );

            console.log(`[Blockchain] TX submitted: ${tx.hash}`);

            // Wait for 1 confirmation
            const receipt = await tx.wait(1);
            console.log(`[Blockchain] Confirmed in block ${receipt.blockNumber}`);

            // Extract alertId from emitted AlertLogged event
            let alertId = null;
            if (receipt.logs && receipt.logs.length > 0) {
                try {
                    const iface = this.contract.interface;
                    for (const log of receipt.logs) {
                        try {
                            const parsed = iface.parseLog(log);
                            if (parsed && parsed.name === 'AlertLogged') {
                                alertId = Number(parsed.args.alertId);
                                break;
                            }
                        } catch (_) { /* skip non-matching logs */ }
                    }
                } catch (parseErr) {
                    console.warn('[Blockchain] Could not parse AlertLogged event:', parseErr.message);
                }
            }

            return {
                txHash: tx.hash,
                alertId,
                blockNumber: receipt.blockNumber,
            };
        } catch (err) {
            console.error('[Blockchain] logAlert error:', err.message);
            return null;
        }
    }

    /**
     * Resolve an alert on-chain.
     */
    async resolveAlert(blockchainAlertId) {
        if (!this.isReady || blockchainAlertId === null) return null;

        try {
            const tx = await this.contract.resolveAlert(blockchainAlertId, { gasLimit: 100000 });
            const receipt = await tx.wait(1);
            return { txHash: tx.hash, blockNumber: receipt.blockNumber };
        } catch (err) {
            console.error('[Blockchain] resolveAlert error:', err.message);
            return null;
        }
    }

    /**
     * Get total number of alerts on-chain.
     */
    async getTotalAlerts() {
        if (!this.isReady) return 0;
        try {
            const total = await this.contract.getTotalAlerts();
            return Number(total);
        } catch (err) {
            console.error('[Blockchain] getTotalAlerts error:', err.message);
            return 0;
        }
    }

    /**
     * Get paginated alerts from blockchain.
     */
    async getAlertsPaginated(offset = 0, limit = 20) {
        if (!this.isReady) return { result: [], total: 0 };
        try {
            const [result, total] = await this.contract.getAlertsPaginated(offset, limit);
            return { result, total: Number(total) };
        } catch (err) {
            console.error('[Blockchain] getAlertsPaginated error:', err.message);
            return { result: [], total: 0 };
        }
    }
}

module.exports = new BlockchainService();
