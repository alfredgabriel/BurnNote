# BurnNote 🔥

> **Self-hosted, encrypted one-time notes with password protection and automatic destruction.**  
> *Share it once. Then it's gone.*

---

## 1. Overview

**BurnNote** is a privacy-first, self-hosted web application designed to securely transfer sensitive information—such as temporary passwords, private API keys, recovery seeds, configuration secrets, and confidential messages—through **one-time, self-destructing links**.

Inspired by Privnote, BurnNote is engineered from the ground up for self-hosters with a **Zero-Knowledge cryptographic architecture**:
* The server **never sees** your plaintext note.
* The server **never sees** your password.
* Notes are **atomically destroyed** after a single successful reading.
* If an incorrect password is entered, the note is **instantly and permanently destroyed** to prevent brute-force attacks.

---

## 2. Security & Cryptographic Model

### True End-to-End Encryption (E2EE)

All cryptographic operations occur **entirely in the user's browser** via the hardware-accelerated Web Crypto API:

```text
CREATOR BROWSER
   │
   ├─► Plaintext Secret + Password
   │
   ├─► PBKDF2-HMAC-SHA-256 (600,000 iterations, 128-bit CSPRNG salt)
   │     ├─► K_enc  (256 bits for AES-256-GCM encryption)
   │     └─► K_auth (256 bits authentication verifier)
   │
   ├─► AES-256-GCM Encrypt(Plaintext, K_enc, 96-bit IV)
   │     └─► Ciphertext + 128-bit Authentication Tag
   │
   └─► Sends to Server:
         - SHA-256(token)
         - Ciphertext, IV, Tag, Salt
         - SHA-256(K_auth)  <-- Never the raw password or K_auth
```

```text
RECIPIENT BROWSER
   │
   ├─► Opens /n/[token]
   ├─► Fetches public salt from server
   ├─► User inputs Password
   ├─► Computes K_auth via PBKDF2(Password, Salt)
   │
   ├─► Sends K_auth to /api/notes/[token]/consume
   │
   ▼
BURNNOTE SERVER (Atomic Transaction)
   │
   ├─► Compares SHA-256(K_auth) with stored auth_hash (timingSafeEqual)
   │     │
   │     ├── MISMATCH:
   │     │     ├─► DELETE FROM notes WHERE id = ? (INSTANT BURN)
   │     │     └─► Returns generic 404: "This BurnNote is no longer available."
   │     │
   │     └── MATCH:
   │           ├─► DELETE FROM notes WHERE id = ? (ATOMIC CONSUMPTION)
   │           └─► Returns Ciphertext, IV, Tag, Salt
   │
   ▼
RECIPIENT BROWSER
   │
   └─► AES-256-GCM Decrypt(Ciphertext, K_enc, IV, Tag)
         └─► Plaintext displayed safely as text inside <pre>
```

### Cryptographic Primitives
* **Symmetric Cipher**: `AES-256-GCM` (authenticated encryption, prevents tampering).
* **Key Derivation**: `PBKDF2` with `HMAC-SHA-256` and **600,000 iterations** (OWASP recommended standard).
* **Randomness**: Web Crypto / Node CSPRNG (`crypto.getRandomValues`).
* **Tokens**: 256 bits of entropy (64 hex characters). The raw token is **never stored** in the database; only `SHA-256(token)` is indexed.
* **Timing-Safe Comparison**: `crypto.timingSafeEqual` prevents side-channel timing attacks.

---

## 3. Threat Model

### What BurnNote Protects Against
* **Database Leaks / Compromised Storage**: The database only stores ciphertext and salted hashes. Even with full access to the SQLite file, an attacker cannot read the notes without the link token and password.
* **Server Operator Snooping**: Encryption and decryption occur strictly inside client browsers.
* **Token Guessing**: 256-bit entropy tokens make URL guessing statistically impossible.
* **Brute-Force Password Guessing**: By default, entering the wrong password **permanently destroys the note immediately**.
* **Race Conditions & Concurrency**: Atomic SQLite write transactions guarantee that two simultaneous requests can never both retrieve the same note.
* **Information Leakage via Error Messages**: Expired, missing, consumed, or burned notes all return the exact same generic response: *"This BurnNote is no longer available."*
* **XSS Payloads**: Note content is rendered strictly as plain text (`<pre>{note}</pre>`). No HTML parsing is ever performed.
* **Log Leakage**: Plaintext secrets, raw passwords, and raw tokens are excluded from application logs.

### What BurnNote Cannot Protect Against
* **Compromised Endpoints**: Malware, keyloggers, or malicious browser extensions on the creator's or recipient's machine.
* **Recipients Taking Copies**: Screenshots, photographs, copy-pasting, or saving the decrypted text once unlocked.
* **Compromised Transport without HTTPS**: If deployed over unencrypted HTTP over the public internet, adversaries on the local network could intercept tokens. **Always deploy behind HTTPS / TLS in production.**
* **Forensic Physical Drive Recovery**: Application-level deletion marks database pages as free in SQLite; forensic recovery of magnetic/solid-state media is out of scope for application software.

---

## 4. Self-Hosting & Deployment

BurnNote is designed to run entirely locally without requiring port-forwarding or exposing your home IP address.

### Option A: Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/alfredgabriel/BurnNote.git
   cd BurnNote
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

3. Launch the container:
   ```bash
   docker compose up -d
   ```

The application will be accessible at `http://localhost:3000`. SQLite data persists in the `./data` directory.

---

### Option B: Remote Access via Cloudflare Tunnel (Zero Port-Forwarding)

You do **not** need a static public IP or router port-forwarding to securely access your BurnNote instance remotely:

1. Install `cloudflared` on your host:
   ```bash
   # Debian / Ubuntu
   sudo apt-get install cloudflared
   ```

2. Authenticate and create a tunnel:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create burnnote
   ```

3. Route traffic to your BurnNote local container (`http://localhost:3000`):
   ```yaml
   # ~/.cloudflared/config.yml
   tunnel: <TUNNEL_UUID>
   credentials-file: /root/.cloudflared/<TUNNEL_UUID>.json
   ingress:
     - hostname: notes.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```

4. Run the tunnel:
   ```bash
   cloudflared tunnel run burnnote
   ```

Cloudflare provides end-to-end HTTPS with automatic certificates without exposing your home IP.

---

### Option C: Manual Node.js Development

Requirements: Node.js 20+ (Node 22 recommended)

```bash
# Install dependencies
npm install

# Run automated tests
npm test

# Start development server
npm run dev

# Build and run production bundle
npm run build
node build
```

---

## 5. Configuration & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Environment mode (`production` / `development`) |
| `PORT` | `3000` | Port for the HTTP server |
| `ORIGIN` | `http://localhost:3000` | Allowed origin for CSRF validation |
| `DATABASE_PATH` | `./data/burnnote.db` | Filesystem path to the SQLite database |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Sliding window in milliseconds (1 minute) |
| `RATE_LIMIT_MAX_REQUESTS` | `30` | Maximum allowed requests per IP in the window |
| `CLEANUP_INTERVAL_MS` | `300000` | Interval for purging expired notes (5 minutes) |

---

## 6. Automated Testing

The automated test suite verifies all cryptographic operations, SQLite transactions, concurrency, and security attack vectors:

```bash
npm test
```

Test coverage includes:
* 256-bit CSPRNG token entropy
* AES-256-GCM encryption & decryption correctness
* Atomic one-time access verification (cannot read twice)
* Burn-on-incorrect-password instant destruction
* Expiration enforcement and background sweeping
* 10-way simultaneous race condition simulation
* XSS payload isolation and SQL injection resistance

---

## 7. License

MIT License &copy; 2026 BurnNote Contributors.
