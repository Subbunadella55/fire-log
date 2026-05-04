// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title FireAlertLogger
 * @author PyroChain Team
 * @notice Tamper-proof, blockchain-based fire alert logging system.
 *         Only an authorized backend wallet may log alerts.
 *         All events are permanently stored on-chain.
 * @dev Gas-optimized using packed structs and indexed events.
 */
contract FireAlertLogger {

    // ─────────────────────────────────────────────
    //  Access Control
    // ─────────────────────────────────────────────

    address public owner;
    address public authorizedBackend;

    modifier onlyOwner() {
        require(msg.sender == owner, "FireAlertLogger: Not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == authorizedBackend || msg.sender == owner,
            "FireAlertLogger: Not authorized"
        );
        _;
    }

    // ─────────────────────────────────────────────
    //  Data Structures
    // ─────────────────────────────────────────────

    /**
     * @dev Packed struct to minimize storage slots.
     *      temperature: stored as int16 (°C × 10, e.g. 55.5°C → 555)
     *      smokeLevel : raw ADC value 0-1023
     *      severity   : 0=Normal,1=Low,2=Medium,3=High,4=Critical
     */
    struct FireAlert {
        string   deviceId;       // Unique sensor node ID
        int16    temperature;    // Temperature × 10 (°C)
        uint16   humidity;       // Humidity × 10 (%)
        uint16   smokeLevel;     // MQ2 ADC reading 0-1023
        uint8    severity;       // 0-4 mapped to severity levels
        string   location;       // Human-readable location
        int32    latitude;       // GPS lat × 1e6
        int32    longitude;      // GPS lon × 1e6
        uint256  timestamp;      // Unix epoch (seconds)
        bool     resolved;       // Has the alert been resolved?
        address  loggedBy;       // Which wallet logged this alert
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    FireAlert[] private alerts;  // All alerts ever logged

    // Mapping: deviceId hash → array of alert indices for fast lookup
    mapping(bytes32 => uint256[]) private alertsByDevice;

    // Mapping: alert index → resolved status (gas-efficient separate mapping)
    mapping(uint256 => bool) public resolvedAlerts;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    /**
     * @notice Emitted when a new fire alert is logged.
     * @param alertId  The index of the alert in the alerts array.
     * @param deviceId Sensor node identifier.
     * @param severity Numeric severity (0-4).
     * @param timestamp Unix epoch when the alert occurred.
     */
    event AlertLogged(
        uint256 indexed alertId,
        string  indexed deviceId,
        uint8   indexed severity,
        uint256         timestamp,
        string          location
    );

    /**
     * @notice Emitted when an alert is resolved.
     */
    event AlertResolved(
        uint256 indexed alertId,
        string  indexed deviceId,
        uint256         resolvedAt
    );

    /**
     * @notice Emitted when the authorized backend wallet changes.
     */
    event BackendUpdated(address indexed oldBackend, address indexed newBackend);

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    /**
     * @param _authorizedBackend Wallet address of the Node.js backend.
     */
    constructor(address _authorizedBackend) {
        require(_authorizedBackend != address(0), "Zero address not allowed");
        owner             = msg.sender;
        authorizedBackend = _authorizedBackend;
    }

    // ─────────────────────────────────────────────
    //  Core Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Log a new fire alert on-chain.
     * @dev Only callable by the authorized backend wallet.
     * @param _deviceId    Unique sensor node identifier (e.g. "ESP8266_NODE_001")
     * @param _temperature Temperature in Celsius × 10 (e.g. 55.5°C → 555)
     * @param _humidity    Humidity in % × 10 (e.g. 72.5% → 725)
     * @param _smokeLevel  MQ2 gas sensor ADC value (0-1023)
     * @param _severity    Severity level: 0=Normal,1=Low,2=Medium,3=High,4=Critical
     * @param _location    Human-readable location string
     * @param _latitude    GPS latitude × 1,000,000 (e.g. 17.385044 → 17385044)
     * @param _longitude   GPS longitude × 1,000,000 (e.g. 78.486671 → 78486671)
     * @param _timestamp   Unix epoch timestamp from sensor
     * @return alertId     The index of the newly logged alert
     */
    function logAlert(
        string  calldata _deviceId,
        int16            _temperature,
        uint16           _humidity,
        uint16           _smokeLevel,
        uint8            _severity,
        string  calldata _location,
        int32            _latitude,
        int32            _longitude,
        uint256          _timestamp
    )
        external
        onlyAuthorized
        returns (uint256 alertId)
    {
        require(bytes(_deviceId).length > 0,  "Device ID required");
        require(bytes(_location).length > 0,  "Location required");
        require(_severity <= 4,               "Severity must be 0-4");
        require(_smokeLevel <= 1023,          "Smoke level out of range");
        require(_timestamp > 0,              "Invalid timestamp");

        alertId = alerts.length;

        alerts.push(FireAlert({
            deviceId    : _deviceId,
            temperature : _temperature,
            humidity    : _humidity,
            smokeLevel  : _smokeLevel,
            severity    : _severity,
            location    : _location,
            latitude    : _latitude,
            longitude   : _longitude,
            timestamp   : _timestamp,
            resolved    : false,
            loggedBy    : msg.sender
        }));

        // Index by device for efficient retrieval
        alertsByDevice[keccak256(bytes(_deviceId))].push(alertId);

        emit AlertLogged(alertId, _deviceId, _severity, _timestamp, _location);
    }

    /**
     * @notice Mark an alert as resolved (fire extinguished / false alarm).
     * @param _alertId Index of the alert to resolve.
     */
    function resolveAlert(uint256 _alertId) external onlyAuthorized {
        require(_alertId < alerts.length,    "Alert does not exist");
        require(!alerts[_alertId].resolved,  "Alert already resolved");

        alerts[_alertId].resolved = true;
        resolvedAlerts[_alertId]  = true;

        emit AlertResolved(_alertId, alerts[_alertId].deviceId, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  Query Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Retrieve a single alert by its ID.
     */
    function getAlert(uint256 _alertId)
        external
        view
        returns (FireAlert memory)
    {
        require(_alertId < alerts.length, "Alert does not exist");
        return alerts[_alertId];
    }

    /**
     * @notice Retrieve ALL alerts ever logged.
     * @dev NOTE: Use with caution in production — may be gas-heavy for large sets.
     *            Prefer getAlertsPaginated for large datasets.
     */
    function getAllAlerts() external view returns (FireAlert[] memory) {
        return alerts;
    }

    /**
     * @notice Retrieve alerts with pagination support.
     * @param _offset Starting index.
     * @param _limit  Maximum number of alerts to return.
     */
    function getAlertsPaginated(uint256 _offset, uint256 _limit)
        external
        view
        returns (FireAlert[] memory result, uint256 total)
    {
        total = alerts.length;
        if (_offset >= total) {
            return (new FireAlert[](0), total);
        }

        uint256 end   = _offset + _limit;
        if (end > total) end = total;
        uint256 count = end - _offset;

        result = new FireAlert[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = alerts[_offset + i];
        }
    }

    /**
     * @notice Get all alert IDs for a specific device.
     */
    function getAlertsByDevice(string calldata _deviceId)
        external
        view
        returns (uint256[] memory)
    {
        return alertsByDevice[keccak256(bytes(_deviceId))];
    }

    /**
     * @notice Get total number of alerts logged.
     */
    function getTotalAlerts() external view returns (uint256) {
        return alerts.length;
    }

    /**
     * @notice Get severity label string for a numeric severity value.
     */
    function getSeverityLabel(uint8 _severity)
        external
        pure
        returns (string memory)
    {
        if (_severity == 0) return "Normal";
        if (_severity == 1) return "Low";
        if (_severity == 2) return "Medium";
        if (_severity == 3) return "High";
        if (_severity == 4) return "Critical";
        revert("Invalid severity");
    }

    // ─────────────────────────────────────────────
    //  Admin Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Update the authorized backend wallet address.
     */
    function setAuthorizedBackend(address _newBackend) external onlyOwner {
        require(_newBackend != address(0), "Zero address not allowed");
        emit BackendUpdated(authorizedBackend, _newBackend);
        authorizedBackend = _newBackend;
    }

    /**
     * @notice Transfer contract ownership.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Zero address not allowed");
        owner = _newOwner;
    }
}
