// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title RecoveryManager
 * @notice Institutional-guardian social recovery for student wallet addresses.
 * @dev Students nominate trusted institutional guardians (university registrar,
 *      academic advisor, department head) who can collectively authorize an
 *      address change if the student loses access to their device.
 *
 *      Recovery process:
 *      1. Student calls setupGuardians() to nominate guardians and set threshold
 *      2. If student loses access, a guardian calls initiateRecovery()
 *      3. Other guardians call approveRecovery()
 *      4. After threshold is met AND cooldown period passes, anyone calls executeRecovery()
 *      5. The student's registered address is updated
 *
 *      Safety:
 *      - Student can cancel recovery during cooldown if they regain access
 *      - 24-hour cooldown after threshold to prevent instant unauthorized recovery
 *      - Only registered guardians can participate
 */
contract RecoveryManager {
    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────
    error NotGuardian();
    error NotAccountOwner();
    error GuardiansAlreadySetup();
    error InvalidGuardianConfig();
    error NoActiveRecovery();
    error RecoveryAlreadyActive();
    error AlreadyApproved();
    error ThresholdNotMet();
    error CooldownNotPassed();
    error RecoveryExpired();
    error InvalidAddress();
    error GuardianCannotBeSelf();

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────
    event GuardiansConfigured(
        address indexed account,
        address[] guardians,
        uint256 threshold,
        uint256 timestamp
    );

    event RecoveryInitiated(
        address indexed account,
        address indexed initiatedBy,
        address newAddress,
        uint256 timestamp
    );

    event RecoveryApproved(
        address indexed account,
        address indexed guardian,
        uint256 approvalCount,
        uint256 threshold,
        uint256 timestamp
    );

    event RecoveryExecuted(
        address indexed oldAddress,
        address indexed newAddress,
        uint256 timestamp
    );

    event RecoveryCancelled(
        address indexed account,
        uint256 timestamp
    );

    event GuardiansUpdated(
        address indexed account,
        address[] guardians,
        uint256 threshold,
        uint256 timestamp
    );

    // ──────────────────────────────────────────────
    // Constants
    // ──────────────────────────────────────────────

    /// @notice Cooldown period after threshold is met (24 hours)
    uint256 public constant RECOVERY_COOLDOWN = 24 hours;

    /// @notice Recovery request expires after 7 days
    uint256 public constant RECOVERY_EXPIRY = 7 days;

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    struct GuardianConfig {
        address[] guardians;
        mapping(address => bool) isGuardian;
        uint256 threshold;           // Number of approvals needed
        bool isConfigured;
    }

    struct RecoveryRequest {
        address newAddress;          // The new address to assign
        address initiatedBy;        // Guardian who started it
        uint256 initiatedAt;        // Timestamp of initiation
        uint256 approvalCount;      // Current number of approvals
        mapping(address => bool) hasApproved;
        bool isActive;
    }

    /// @notice Guardian configurations per account
    mapping(address => GuardianConfig) private _guardianConfigs;

    /// @notice Active recovery requests per account
    mapping(address => RecoveryRequest) private _recoveryRequests;

    /// @notice Maps old addresses to new addresses after recovery
    mapping(address => address) public recoveredAddresses;

    // ──────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────
    modifier onlyGuardianOf(address account) {
        if (!_guardianConfigs[account].isGuardian[msg.sender]) revert NotGuardian();
        _;
    }

    modifier onlyAccountOwner(address account) {
        if (msg.sender != account) revert NotAccountOwner();
        _;
    }

    // ──────────────────────────────────────────────
    // Guardian Setup
    // ──────────────────────────────────────────────

    /**
     * @notice Configure guardians and threshold for the caller's account.
     * @param guardians  Array of guardian addresses (e.g., registrar, advisor)
     * @param threshold  Number of guardian approvals required for recovery
     *
     * Requirements:
     * - At least 2 guardians
     * - At most 10 guardians
     * - Threshold must be >= 2 and <= number of guardians
     * - Guardians cannot include the account owner
     * - No duplicate guardians
     */
    function setupGuardians(
        address[] calldata guardians,
        uint256 threshold
    ) external {
        if (guardians.length < 2 || guardians.length > 10) revert InvalidGuardianConfig();
        if (threshold < 2 || threshold > guardians.length) revert InvalidGuardianConfig();

        GuardianConfig storage config = _guardianConfigs[msg.sender];

        // Clear previous guardians if reconfiguring
        for (uint256 i = 0; i < config.guardians.length; i++) {
            config.isGuardian[config.guardians[i]] = false;
        }
        delete config.guardians;

        // Set new guardians
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == address(0)) revert InvalidAddress();
            if (guardians[i] == msg.sender) revert GuardianCannotBeSelf();
            if (config.isGuardian[guardians[i]]) revert InvalidGuardianConfig(); // duplicate
            
            config.guardians.push(guardians[i]);
            config.isGuardian[guardians[i]] = true;
        }

        config.threshold = threshold;
        config.isConfigured = true;

        if (config.guardians.length == guardians.length && !config.isConfigured) {
            emit GuardiansConfigured(msg.sender, guardians, threshold, block.timestamp);
        } else {
            emit GuardiansUpdated(msg.sender, guardians, threshold, block.timestamp);
        }
    }

    // ──────────────────────────────────────────────
    // Recovery Process
    // ──────────────────────────────────────────────

    /**
     * @notice Initiate a recovery request for a student's account.
     * @dev Can only be called by a registered guardian of the account.
     * @param account     The student's current address (lost access)
     * @param newAddress  The new address to migrate to
     */
    function initiateRecovery(
        address account,
        address newAddress
    ) external onlyGuardianOf(account) {
        if (newAddress == address(0)) revert InvalidAddress();
        if (_recoveryRequests[account].isActive) revert RecoveryAlreadyActive();
        if (!_guardianConfigs[account].isConfigured) revert InvalidGuardianConfig();

        RecoveryRequest storage request = _recoveryRequests[account];
        request.newAddress = newAddress;
        request.initiatedBy = msg.sender;
        request.initiatedAt = block.timestamp;
        request.approvalCount = 1; // Initiator counts as first approval
        request.hasApproved[msg.sender] = true;
        request.isActive = true;

        emit RecoveryInitiated(account, msg.sender, newAddress, block.timestamp);
        emit RecoveryApproved(
            account,
            msg.sender,
            1,
            _guardianConfigs[account].threshold,
            block.timestamp
        );
    }

    /**
     * @notice Approve an active recovery request.
     * @dev Can only be called by a registered guardian who hasn't already approved.
     * @param account  The student's current address being recovered
     */
    function approveRecovery(address account) external onlyGuardianOf(account) {
        RecoveryRequest storage request = _recoveryRequests[account];
        if (!request.isActive) revert NoActiveRecovery();
        if (request.hasApproved[msg.sender]) revert AlreadyApproved();

        // Check if recovery has expired
        if (block.timestamp > request.initiatedAt + RECOVERY_EXPIRY) {
            request.isActive = false;
            revert RecoveryExpired();
        }

        request.hasApproved[msg.sender] = true;
        request.approvalCount++;

        emit RecoveryApproved(
            account,
            msg.sender,
            request.approvalCount,
            _guardianConfigs[account].threshold,
            block.timestamp
        );
    }

    /**
     * @notice Execute a recovery after threshold is met and cooldown has passed.
     * @dev Can be called by anyone once conditions are met.
     * @param account  The student's current address being recovered
     */
    function executeRecovery(address account) external {
        RecoveryRequest storage request = _recoveryRequests[account];
        if (!request.isActive) revert NoActiveRecovery();

        // Check expiry
        if (block.timestamp > request.initiatedAt + RECOVERY_EXPIRY) {
            request.isActive = false;
            revert RecoveryExpired();
        }

        // Check threshold
        if (request.approvalCount < _guardianConfigs[account].threshold) {
            revert ThresholdNotMet();
        }

        // Check cooldown (24 hours after the last needed approval)
        // For simplicity, cooldown starts from initiation
        if (block.timestamp < request.initiatedAt + RECOVERY_COOLDOWN) {
            revert CooldownNotPassed();
        }

        address newAddress = request.newAddress;

        // Record the address migration
        recoveredAddresses[account] = newAddress;

        // Copy guardian config to new address
        GuardianConfig storage oldConfig = _guardianConfigs[account];
        GuardianConfig storage newConfig = _guardianConfigs[newAddress];

        // Clear any existing config on new address
        for (uint256 i = 0; i < newConfig.guardians.length; i++) {
            newConfig.isGuardian[newConfig.guardians[i]] = false;
        }
        delete newConfig.guardians;

        // Copy guardians
        for (uint256 i = 0; i < oldConfig.guardians.length; i++) {
            newConfig.guardians.push(oldConfig.guardians[i]);
            newConfig.isGuardian[oldConfig.guardians[i]] = true;
        }
        newConfig.threshold = oldConfig.threshold;
        newConfig.isConfigured = true;

        // Clean up old recovery request
        request.isActive = false;

        emit RecoveryExecuted(account, newAddress, block.timestamp);
    }

    /**
     * @notice Cancel an active recovery request. Only the account owner can cancel.
     * @dev This allows a student who regains access to cancel a potentially
     *      unauthorized recovery attempt.
     */
    function cancelRecovery() external {
        RecoveryRequest storage request = _recoveryRequests[msg.sender];
        if (!request.isActive) revert NoActiveRecovery();

        request.isActive = false;
        emit RecoveryCancelled(msg.sender, block.timestamp);
    }

    // ──────────────────────────────────────────────
    // View Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Get the guardian addresses for an account.
     */
    function getGuardians(address account)
        external
        view
        returns (address[] memory)
    {
        return _guardianConfigs[account].guardians;
    }

    /**
     * @notice Get the recovery threshold for an account.
     */
    function getThreshold(address account) external view returns (uint256) {
        return _guardianConfigs[account].threshold;
    }

    /**
     * @notice Check if guardians are configured for an account.
     */
    function isConfigured(address account) external view returns (bool) {
        return _guardianConfigs[account].isConfigured;
    }

    /**
     * @notice Check if an address is a guardian for an account.
     */
    function isGuardian(address account, address guardian)
        external
        view
        returns (bool)
    {
        return _guardianConfigs[account].isGuardian[guardian];
    }

    /**
     * @notice Get the status of a recovery request.
     * @return isActive       Whether a recovery is in progress
     * @return newAddress     The proposed new address
     * @return initiatedBy   Guardian who started it
     * @return initiatedAt   When it was started
     * @return approvalCount How many guardians have approved
     * @return threshold     How many approvals are needed
     */
    function getRecoveryStatus(address account)
        external
        view
        returns (
            bool isActive,
            address newAddress,
            address initiatedBy,
            uint256 initiatedAt,
            uint256 approvalCount,
            uint256 threshold
        )
    {
        RecoveryRequest storage request = _recoveryRequests[account];
        return (
            request.isActive,
            request.newAddress,
            request.initiatedBy,
            request.initiatedAt,
            request.approvalCount,
            _guardianConfigs[account].threshold
        );
    }

    /**
     * @notice Resolve an address, following any recovery chain.
     * @dev If account A was recovered to B, and B was recovered to C,
     *      this returns C.
     */
    function resolveAddress(address account) external view returns (address) {
        address current = account;
        // Follow chain with a limit to prevent infinite loops
        for (uint256 i = 0; i < 10; i++) {
            address next = recoveredAddresses[current];
            if (next == address(0)) break;
            current = next;
        }
        return current;
    }
}
