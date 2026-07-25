// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SoulboundCertificate
 * @notice Non-transferable ERC-721 NFT representing academic credentials.
 * @dev Implements ERC-5192 (Minimal Soulbound NFTs) by overriding transfer
 *      functions to revert. Tokens can only be minted (issued) and burned
 *      (revoked), never transferred between addresses.
 *
 *      Only authorized issuers (universities) registered in the contract
 *      can mint and revoke certificates.
 */
contract SoulboundCertificate is ERC721, Ownable {
    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────
    error Soulbound();
    error NotIssuer();
    error CertificateAlreadyRevoked();
    error CertificateDoesNotExist();

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────
    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed student,
        address indexed issuer,
        string metadataURI,
        uint256 timestamp
    );

    event CertificateRevoked(
        uint256 indexed tokenId,
        address indexed issuer,
        uint256 timestamp
    );

    event IssuerAuthorized(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    // ERC-5192 event
    event Locked(uint256 tokenId);

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────
    struct CertificateData {
        address issuer;
        address student;
        string metadataURI;     // IPFS URI for full certificate data
        uint256 issuedAt;
        bool revoked;
    }

    uint256 private _nextTokenId;
    
    /// @notice Mapping from tokenId to certificate data
    mapping(uint256 => CertificateData) private _certificates;

    /// @notice Addresses authorized to issue and revoke certificates
    mapping(address => bool) public authorizedIssuers;

    /// @notice All token IDs owned by a student
    mapping(address => uint256[]) private _studentTokens;

    /// @notice All token IDs issued by an issuer
    mapping(address => uint256[]) private _issuerTokens;

    // ──────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────
    modifier onlyIssuer() {
        if (!authorizedIssuers[msg.sender]) revert NotIssuer();
        _;
    }

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────
    constructor() ERC721("EduWallet Certificate", "EDUCERT") Ownable(msg.sender) {
        _nextTokenId = 1;
    }

    // ──────────────────────────────────────────────
    // Issuer Management (Owner only)
    // ──────────────────────────────────────────────

    /// @notice Authorize an address (university) to issue certificates
    function authorizeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = true;
        emit IssuerAuthorized(issuer);
    }

    /// @notice Remove issuer authorization
    function removeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    // ──────────────────────────────────────────────
    // Certificate Issuance & Revocation
    // ──────────────────────────────────────────────

    /**
     * @notice Issue a new soulbound certificate to a student.
     * @param student  The student's wallet address
     * @param metadataURI  IPFS URI pointing to certificate metadata JSON
     * @return tokenId  The ID of the newly minted certificate
     */
    function issueCertificate(
        address student,
        string calldata metadataURI
    ) external onlyIssuer returns (uint256) {
        uint256 tokenId = _nextTokenId++;

        _safeMint(student, tokenId);

        _certificates[tokenId] = CertificateData({
            issuer: msg.sender,
            student: student,
            metadataURI: metadataURI,
            issuedAt: block.timestamp,
            revoked: false
        });

        _studentTokens[student].push(tokenId);
        _issuerTokens[msg.sender].push(tokenId);

        emit CertificateIssued(tokenId, student, msg.sender, metadataURI, block.timestamp);
        emit Locked(tokenId); // ERC-5192

        return tokenId;
    }

    /**
     * @notice Revoke a certificate. Only the original issuer can revoke.
     * @param tokenId  The certificate token ID to revoke
     */
    function revokeCertificate(uint256 tokenId) external onlyIssuer {
        CertificateData storage cert = _certificates[tokenId];
        if (cert.issuedAt == 0) revert CertificateDoesNotExist();
        if (cert.revoked) revert CertificateAlreadyRevoked();
        if (cert.issuer != msg.sender) revert NotIssuer();

        cert.revoked = true;
        emit CertificateRevoked(tokenId, msg.sender, block.timestamp);
    }

    // ──────────────────────────────────────────────
    // Verification (Public, View)
    // ──────────────────────────────────────────────

    /**
     * @notice Verify a certificate's authenticity and validity.
     * @param tokenId  The certificate token ID
     * @return isValid    True if certificate exists and is not revoked
     * @return student    The student's address
     * @return issuer     The issuing university's address
     * @return metadataURI  IPFS URI for full certificate data
     * @return issuedAt   Timestamp when issued
     */
    function verifyCertificate(uint256 tokenId)
        external
        view
        returns (
            bool isValid,
            address student,
            address issuer,
            string memory metadataURI,
            uint256 issuedAt
        )
    {
        CertificateData storage cert = _certificates[tokenId];
        if (cert.issuedAt == 0) revert CertificateDoesNotExist();

        return (
            !cert.revoked,
            cert.student,
            cert.issuer,
            cert.metadataURI,
            cert.issuedAt
        );
    }

    /**
     * @notice Get all certificate token IDs for a student.
     */
    function getStudentCertificates(address student)
        external
        view
        returns (uint256[] memory)
    {
        return _studentTokens[student];
    }

    /**
     * @notice Get all certificate token IDs issued by an issuer.
     */
    function getIssuerCertificates(address issuer)
        external
        view
        returns (uint256[] memory)
    {
        return _issuerTokens[issuer];
    }

    /**
     * @notice Get the full certificate data for a token.
     */
    function getCertificate(uint256 tokenId)
        external
        view
        returns (CertificateData memory)
    {
        if (_certificates[tokenId].issuedAt == 0) revert CertificateDoesNotExist();
        return _certificates[tokenId];
    }

    // ──────────────────────────────────────────────
    // ERC-5192: Soulbound Implementation
    // ──────────────────────────────────────────────

    /**
     * @notice Returns true if the token is locked (always true for soulbound).
     * @dev Required by ERC-5192.
     */
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    /**
     * @notice ERC-165 interface support (includes ERC-5192 interface ID).
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override
        returns (bool)
    {
        // 0xb45a3c0e is the ERC-5192 interface ID
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns the metadata URI for a token.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        _requireOwned(tokenId);
        return _certificates[tokenId].metadataURI;
    }

    // ──────────────────────────────────────────────
    // Transfer Restrictions (Soulbound)
    // ──────────────────────────────────────────────

    /**
     * @dev Override _update to prevent all transfers. Only mint (from=0)
     *      and burn (to=0) are allowed.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow mint (from == address(0)) and burn (to == address(0))
        // Block all transfers (from != 0 && to != 0)
        if (from != address(0) && to != address(0)) {
            revert Soulbound();
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Override approve to prevent approvals (soulbound tokens can't be approved for transfer).
     */
    function approve(address, uint256) public virtual override {
        revert Soulbound();
    }

    /**
     * @dev Override setApprovalForAll to prevent blanket approvals.
     */
    function setApprovalForAll(address, bool) public virtual override {
        revert Soulbound();
    }
}
