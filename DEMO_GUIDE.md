# EduWallet: Complete Demonstration Guide

This guide provides a step-by-step walkthrough to demonstrate all the features of the EduWallet platform, from user registration to cryptographic credential verification.

---

## Prerequisites
1. Ensure the development server is running (`npm run dev` in the `frontend` folder).
2. Open your browser to [http://localhost:3000](http://localhost:3000).

---

## 🎭 Scene 1: The University Setup

In this scene, you will act as a University Administrator to register an institution and issue a credential.

### 1. Register the University
1. Go to the **EduWallet Homepage**.
2. Click on **"Get Started"** or navigate to `/register`.
3. Fill out the registration form:
   - **Role:** Select `University`
   - **Name:** Enter `Global Tech University`
   - **Email:** `admin@globaltech.edu`
   - **Password:** `password123`
4. Click **Register**. You will be automatically redirected to the University Dashboard.

### 2. Issue a Certificate
1. On the **University Dashboard**, locate the "Issue Certificate" form.
2. We first need a student account to issue to, but for demonstration, let's pretend a student is already registered. Use the following details:
   - **Student Email:** `student@example.com` (We will register this student in Scene 2)
   - **Student Full Name:** `Alex Johnson`
   - **Degree Type:** `Bachelor of Science`
   - **Major:** `Computer Science`
3. Click **Issue Certificate** and confirm the modal.
   - *Note: Since the student isn't registered yet, you will see an error: "Student not found". This demonstrates our validation!*

---

## 🧑‍🎓 Scene 2: The Student Experience

Now, switch roles to act as the Student receiving the certificate.

### 1. Register the Student
1. Log out from the University account using the navigation bar.
2. Go to the **Register** page again.
3. Fill out the form:
   - **Role:** Select `Student`
   - **Name:** `Alex Johnson`
   - **Email:** `student@example.com`
   - **Password:** `password123`
4. Click **Register**. You will be taken to the Student Dashboard. Notice that the dashboard is empty because no certificates have been issued yet.

### 2. Issue the Certificate (Back to University)
1. Log out, and log back in (via `/login`) as the University (`admin@globaltech.edu`).
2. Fill out the "Issue Certificate" form again with Alex's details (`student@example.com`).
3. Click **Issue Certificate** and confirm.
   - *Success! The certificate is minted and pinned to IPFS.*
4. Notice the new certificate appears in the **"Issued Credentials"** table on the University Dashboard.

---

## 🔗 Scene 3: Verification & Sharing

This scene demonstrates the core value proposition: secure, tamper-proof verification.

### 1. View the Certificate
1. Log out, and log back in as the Student (`student@example.com`).
2. On the **Student Dashboard**, you will now see the beautiful "Bachelor of Science" certificate card.
3. Click **"Share"** to copy the secure, UUID-based verification link to your clipboard.
4. Click **"View"** to open the verification page.

### 2. The Verification Page
1. Observe the **Loading Animation**. It simulates querying the Polygon blockchain, validating the signature, and checking the soulbound status.
2. Explore the Certificate Details:
   - Notice the **"Credential Verified ✓"** green banner.
   - See the **IPFS Hash** and **Issuer Address**.
   - Check the **"Non-Transferable (Soulbound)"** badge.
   - Look at the bottom for the **Cryptographic Digital Signature** and the **QR Code**.

### 3. Security Demonstration (The UUID Feature)
1. Look at the URL in your browser. It will look something like `/verify/550e8400-e29b-41d4-a716-446655440000`.
2. Explain to your audience:
   - *"Previously, URLs used sequential IDs like `/verify/1`. This allowed attackers to guess URLs and view all certificates."*
   - *"We implemented a secure UUID lookup. Now, URLs are cryptographically secure and unguessable, protecting student privacy."*

---

## 🛡️ Scene 4: Social Recovery (Optional Advanced Feature)

Demonstrate the decentralized wallet recovery mechanism.

1. On the **Student Dashboard**, click **"Manage Recovery"**.
2. You will see the **Social Recovery Setup** interface.
3. Add 2 or 3 Ethereum/Polygon addresses belonging to "trusted friends or family".
4. Set the **Approval Threshold** (e.g., 2 out of 3 guardians required).
5. Click **Enable Social Recovery**.
6. Explain to the audience: 
   - *"If the student ever loses access to their wallet, their trusted guardians can vote to recover the wallet to a new address, ensuring soulbound credentials are never permanently lost."*

---

## 🎉 Conclusion
You have now successfully demonstrated:
1. Role-based Authentication (University vs Student).
2. Data Validation and Error Handling.
3. Certificate Issuance (with IPFS integration simulation).
4. Secure, UUID-based Cryptographic Verification.
5. Social Recovery Mechanisms.
