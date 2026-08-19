# Rules of Engagement (ROE) — Farm2Market Penetration Test

**Owner:** Project Owner (authorized)

**Contact:** itmusumba@gmail.com

**Date:** 2026-06-01

## Scope

- Targets: https://farm2marketuganda.com and same-origin API endpoints.
- Repository scan: c:\Users\Administrator\Desktop\my-app
- Test accounts: use isolated credentials supplied through the authorized test channel; do not store them in this document.

## Authorization

I, the owner of the project, authorize the following non-destructive tests against the scope above. This ROE serves as written authorization for automated scanning, authenticated grey-box verification using the provided credentials, static code analysis of the repository, and APK static analysis (if APK is provided).

## Allowed Actions

- Automated vulnerability scanning (OWASP ZAP baseline, Nikto, nmap light probes).
- Static analysis and secret scanning of source code (Semgrep, Gitleaks, Snyk, npm audit).
- Authenticated crawling and verification using the provided test accounts.
- APK static analysis using MobSF or equivalent.

## Disallowed / Constraints

- No destructive actions (no DB wipes, no deletion of users, no destructive migrations, no production financial transactions).
- Any write operation must be non-destructive and limited to clearly-marked test accounts. Avoid altering production business-critical data.
- No social engineering, phishing, or physical intrusion.

## Data & DB Safety

Tests must avoid persistence of damaging or irreversible changes. If a test modifies data, it must be reversible or use isolated test data only.

## Test Window & Emergency Contact

Immediate execution authorized by owner. Emergency contact: itmusumba@gmail.com

## Post-Test

- Report delivered including prioritized findings and remediation guidance.
- Rotate provided credentials after testing.

## Acknowledgement (Owner)

Name: ********\_\_\_\_********ISAAC TOM MUSUMBA

Signature: ********\_\_\_\_********isaac tom musumba

Date: ********\_\_\_\_********1st June 2026
