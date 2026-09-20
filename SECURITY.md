# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported          | Security Maintenance Status |
| ------- | ------------------ | --------------------------- |
| 1.0.x   | :white_check_mark: | Active support & patches    |
| < 1.0.0 | :x:                | Deprecated / End of Life    |

---

## Reporting a Vulnerability

We take the security and integrity of our open-source edge streaming architecture seriously. If you discover a potential vulnerability, security bypass, or secret leakage, please report it responsibly so we can remediate it before public disclosure.

### Coordinated Disclosure Process

1. **Do not open a public issue.** Please do not submit vulnerability reports, exploit code, or sensitive logs to the public GitHub Issue Tracker or Discussions.
2. **Submit via GitHub Private Vulnerability Reporting**:
   - Navigate to the repository's **Security** tab.
   - Click on **Advisories** -> **Report a vulnerability**.
3. **Alternative Direct Contact**:
   - Email: `sharvinneve67@gmail.com` with the subject tag `[SECURITY] Streaming-Rpi Vulnerability Report`.
4. **Information to Include**:
   - Type of vulnerability (e.g., SSRF, Remote Code Execution, Privilege Escalation, Secret Exposure).
   - Component affected (`init.py`, edge bash scripts, or Next.js web portal).
   - Step-by-step reproduction steps or minimal Proof-of-Concept (PoC).
   - Potential impact and suggested mitigations if known.

### Response Timelines

- **Initial Acknowledgement**: Within 48 hours of report submission.
- **Triage & Severity Assessment**: Within 5 business days.
- **Fix Delivery & Coordinated Release**: Patches will be tagged and released within 14 days for high/critical vulnerabilities.

---

## Security Architecture & Best Practices

`Streaming-Rpi` adheres to a defense-in-depth model across edge devices and cloud dashboard layers:

### 1. Edge Ingestion & Zero Inbound Ports
- Camera video frames are ingested locally over internal loopback interfaces (`127.0.0.1`) into Simple Realtime Server (SRS).
- No external firewall ports (80, 443, 1935, 8554) need to be forwarded or exposed to the public internet on the Raspberry Pi.
- Remote egress is managed securely via encrypted Cloudflare Tunnels (Zero Trust).

### 2. Transport Security
- All live streams utilize DTLS (Datagram Transport Layer Security) and SRTP (Secure Real-time Transport Protocol) for sub-300ms WebRTC playback.
- Web traffic is enforced over TLS 1.3 / HTTPS.

### 3. Web Dashboard Hardening
- **Strict Content Security Policy (CSP)**: Blocks inline malicious script execution, frame hijacking (`X-Frame-Options: DENY`), and MIME-type sniffing (`X-Content-Type-Options: nosniff`).
- **Defensive Parameter Sanitization**: Prevents path traversal and Server-Side Request Forgery (SSRF) when communicating with edge device APIs.
- **Role-Based Device Isolation**: Enforces tenant boundary isolation so users only access hardware registered to their authenticated organization or site.

### 4. Automated CI/CD Quality & Security Gates
- **Static Application Security Testing (SAST)**: GitHub CodeQL automates deep semantic AST security analysis across Python and TypeScript on every commit.
- **Automated Secret Scanning**: Gitleaks monitors pushes and pull requests to block accidental commits of credentials, private keys, or tokens.
- **Continuous Auditing**: Dependency scanning audits packages against known CVE advisories.
