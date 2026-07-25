// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CredentialRegistry
 * @notice Central registry that maps issuers (universities), students, and
 *         their on-chain credentials. Provides rich metadata storage and
 *         public lookup functions for verification.
 *
 * @dev Works alongside SoulboundCertificate.sol. The owner (system admin)
 *      manages which institutions are approved issuers. Each credential
 *      stores extended metadata (degree type, institution name, etc.)
 *      beyond what the NFT contract stores.
 */
contract CredentialRegistry is Ownable {
    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────
    error IssuerAlreadyRegistered();
    error IssuerNotRegistered();
    error CredentialAlreadyRegistered();
    error CredentialNotFound();
    error OnlyIssuer();

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────
    event IssuerRegistered(
        address indexed issuer,
        string institutionName,
        uint256 timestamp
    );

    event IssuerUnregistered(
        address indexed issuer,
        uint256 timestamp
    );

    event CredentialRegistered(
        uint256 indexed tokenId,
        address indexed student,
        address indexed issuer,
        string degreeType,
        uint256 timestamp
    );

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    struct IssuerInfo {
        string institutionName;
        bool isActive;
        uint256 registeredAt;
        uint256 credentialsIssued;
    }

    struct CredentialMetadata {
        uint256 tokenId;
        address student;
        address issuer;
        string studentName;
        string degreeType;       // e.g., "Bachelor of Science"
        string major;            // e.g., "Computer Science"
        string institutionName;
        string ipfsHash;         // IPFS CID for the PDF certificate
        uint256 issuedAt;
        bool exists;
    }

    /// @notice Registered issuers (universities)
    mapping(address => IssuerInfo) public issuers;

    /// @notice All registered issuer addresses
    address[] public issuerList;

    /// @notice Credential metadata by token ID
    mapping(uint256 => CredentialMetadata) public credentials;

    /// @notice Token IDs belonging to a student
    mapping(address => uint256[]) private _studentCredentials;

    /// @notice Token IDs issued by an issuer
    mapping(address => uint256[]) private _issuerCredentials;

    /// @notice Total credentials registered
    uint256 public totalCredentials;

    // ──────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────
    modifier onlyRegisteredIssuer() {
        if (!issuers[msg.sender].isActive) revert OnlyIssuer();
        _;
    }

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────
    constructor() Ownable(msg.sender) {}

    // ──────────────────────────────────────────────
    // Issuer Management (Owner only)
    // ──────────────────────────────────────────────

    /**
     * @notice Register a new university/institution as an authorized issuer.
     * @param issuer           The institution's wallet address
     * @param institutionName  Human-readable institution name
     */
    function registerIssuer(
        address issuer,
        string calldata institutionName
    ) external onlyOwner {
        if (issuers[issuer].isActive) revert IssuerAlreadyRegistered();

        issuers[issuer] = IssuerInfo({
            institutionName: institutionName,
            isActive: true,
            registeredAt: block.timestamp,
            credentialsIssued: 0
        });

        issuerList.push(issuer);

        emit IssuerRegistered(issuer, institutionName, block.timestamp);
    }

    /**
     * @notice Remove an issuer's authorization. Existing credentials remain valid.
     * @param issuer  The institution's wallet address
     */
    function unregisterIssuer(address issuer) external onlyOwner {
        if (!issuers[issuer].isActive) revert IssuerNotRegistered();
        issuers[issuer].isActive = false;
        emit IssuerUnregistered(issuer, block.timestamp);
    }

    // ──────────────────────────────────────────────
    // Credential Registration
    // ──────────────────────────────────────────────

    /**
     * @notice Register a new credential's metadata. Called after minting the SBT.
     * @param tokenId         The SBT token ID from SoulboundCertificate contract
     * @param student         The student's wallet address
     * @param studentName     The student's full name
     * @param degreeType      e.g., "Bachelor of Science", "Master of Arts"
     * @param major           e.g., "Computer Science"
     * @param ipfsHash        IPFS CID for the PDF certificate
     */
    function registerCredential(
        uint256 tokenId,
        address student,
        string calldata studentName,
        string calldata degreeType,
        string calldata major,
        string calldata ipfsHash
    ) external onlyRegisteredIssuer {
        if (credentials[tokenId].exists) revert CredentialAlreadyRegistered();

        credentials[tokenId] = CredentialMetadata({
            tokenId: tokenId,
            student: student,
            issuer: msg.sender,
            studentName: studentName,
            degreeType: degreeType,
            major: major,
            institutionName: issuers[msg.sender].institutionName,
            ipfsHash: ipfsHash,
            issuedAt: block.timestamp,
            exists: true
        });

        _studentCredentials[student].push(tokenId);
        _issuerCredentials[msg.sender].push(tokenId);
        issuers[msg.sender].credentialsIssued++;
        totalCredentials++;

        emit CredentialRegistered(
            tokenId,
            student,
            msg.sender,
            degreeType,
            block.timestamp
        );
    }

    // ──────────────────────────────────────────────
    // Query Functions (Public, View)
    // ──────────────────────────────────────────────

    /**
     * @notice Get full credential metadata by token ID.
     */
    function getCredential(uint256 tokenId)
        external
        view
        returns (CredentialMetadata memory)
    {
        if (!credentials[tokenId].exists) revert CredentialNotFound();
        return credentials[tokenId];
    }

    /**
     * @notice Get all credential token IDs for a student.
     */
    function getStudentCredentials(address student)
        external
        view
        returns (uint256[] memory)
    {
        return _studentCredentials[student];
    }

    /**
     * @notice Get all credential token IDs issued by an issuer.
     */
    function getIssuerCredentials(address issuer)
        external
        view
        returns (uint256[] memory)
    {
        return _issuerCredentials[issuer];
    }

    /**
     * @notice Get issuer info by address.
     */
    function getIssuerInfo(address issuer)
        external
        view
        returns (IssuerInfo memory)
    {
        return issuers[issuer];
    }

    /**
     * @notice Get the total number of registered issuers.
     */
    function getIssuerCount() external view returns (uint256) {
        return issuerList.length;
    }

    /**
     * @notice Get issuer address by index.
     */
    function getIssuerByIndex(uint256 index) external view returns (address) {
        return issuerList[index];
    }

    /**
     * @notice Check if an address is an active issuer.
     */
    function isActiveIssuer(address issuer) external view returns (bool) {
        return issuers[issuer].isActive;
    }
}
