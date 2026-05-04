// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Copy of smart-contract/FireAlertLogger.sol
// Placed here for Hardhat compilation (Hardhat expects contracts in ./contracts/)
// See ../FireAlertLogger.sol for full documented source

contract FireAlertLogger {
    address public owner;
    address public authorizedBackend;

    struct FireAlert {
        string   deviceId;
        int16    temperature;
        uint16   humidity;
        uint16   smokeLevel;
        uint8    severity;
        string   location;
        int32    latitude;
        int32    longitude;
        uint256  timestamp;
        bool     resolved;
        address  loggedBy;
    }

    FireAlert[] private alerts;
    mapping(bytes32 => uint256[]) private alertsByDevice;
    mapping(uint256 => bool) public resolvedAlerts;

    event AlertLogged(uint256 indexed alertId, string indexed deviceId, uint8 indexed severity, uint256 timestamp, string location);
    event AlertResolved(uint256 indexed alertId, string indexed deviceId, uint256 resolvedAt);
    event BackendUpdated(address indexed oldBackend, address indexed newBackend);

    modifier onlyOwner()      { require(msg.sender == owner,             "Not owner");      _; }
    modifier onlyAuthorized() { require(msg.sender == authorizedBackend || msg.sender == owner, "Not authorized"); _; }

    constructor(address _authorizedBackend) {
        require(_authorizedBackend != address(0), "Zero address");
        owner             = msg.sender;
        authorizedBackend = _authorizedBackend;
    }

    function logAlert(
        string  calldata _deviceId,
        int16   _temperature,
        uint16  _humidity,
        uint16  _smokeLevel,
        uint8   _severity,
        string  calldata _location,
        int32   _latitude,
        int32   _longitude,
        uint256 _timestamp
    ) external onlyAuthorized returns (uint256 alertId) {
        require(bytes(_deviceId).length > 0, "Device ID required");
        require(bytes(_location).length > 0, "Location required");
        require(_severity <= 4,              "Severity 0-4");
        require(_smokeLevel <= 1023,         "Smoke out of range");
        require(_timestamp > 0,             "Invalid timestamp");

        alertId = alerts.length;
        alerts.push(FireAlert({
            deviceId:    _deviceId,
            temperature: _temperature,
            humidity:    _humidity,
            smokeLevel:  _smokeLevel,
            severity:    _severity,
            location:    _location,
            latitude:    _latitude,
            longitude:   _longitude,
            timestamp:   _timestamp,
            resolved:    false,
            loggedBy:    msg.sender
        }));
        alertsByDevice[keccak256(bytes(_deviceId))].push(alertId);
        emit AlertLogged(alertId, _deviceId, _severity, _timestamp, _location);
    }

    function resolveAlert(uint256 _alertId) external onlyAuthorized {
        require(_alertId < alerts.length,   "Alert not found");
        require(!alerts[_alertId].resolved, "Already resolved");
        alerts[_alertId].resolved = true;
        resolvedAlerts[_alertId]  = true;
        emit AlertResolved(_alertId, alerts[_alertId].deviceId, block.timestamp);
    }

    function getAlert(uint256 _alertId) external view returns (FireAlert memory) {
        require(_alertId < alerts.length, "Alert not found");
        return alerts[_alertId];
    }

    function getAllAlerts() external view returns (FireAlert[] memory) { return alerts; }

    function getAlertsPaginated(uint256 _offset, uint256 _limit)
        external view returns (FireAlert[] memory result, uint256 total)
    {
        total = alerts.length;
        if (_offset >= total) return (new FireAlert[](0), total);
        uint256 end = _offset + _limit;
        if (end > total) end = total;
        result = new FireAlert[](end - _offset);
        for (uint256 i = 0; i < end - _offset; i++) result[i] = alerts[_offset + i];
    }

    function getAlertsByDevice(string calldata _deviceId) external view returns (uint256[] memory) {
        return alertsByDevice[keccak256(bytes(_deviceId))];
    }

    function getTotalAlerts() external view returns (uint256) { return alerts.length; }

    function getSeverityLabel(uint8 _severity) external pure returns (string memory) {
        if (_severity == 0) return "Normal";
        if (_severity == 1) return "Low";
        if (_severity == 2) return "Medium";
        if (_severity == 3) return "High";
        if (_severity == 4) return "Critical";
        revert("Invalid severity");
    }

    function setAuthorizedBackend(address _newBackend) external onlyOwner {
        require(_newBackend != address(0), "Zero address");
        emit BackendUpdated(authorizedBackend, _newBackend);
        authorizedBackend = _newBackend;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Zero address");
        owner = _newOwner;
    }
}
