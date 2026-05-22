# Security Policy

## Supported Versions

Refer to the [Releases](https://vitest.dev/releases) page in the documentation for the supported Vitest versions.

## Threat Model

This section describes what Vitest treats as trusted and untrusted. A report is only considered a Vitest vulnerability if it does not require compromising a trusted element first.

> [!NOTE]
> Reports that fall outside the threat model will still be fixed if they represent a real issue, but they will not be treated as security vulnerabilities (e.g., no CVE or advisory will be issued).

Vitest threat model is largely based on [Vite's](https://github.com/vitejs/vite/security/policy).

### What Vitest Does Not Trust

1. **Network data and untrusted clients**
   The dev server and preview server must treat all inbound network requests as potentially hostile. This includes malformed requests. Clients may be outside the developer's intended environment because of port-forwarding, shared networks, or accidental exposure to the internet.

### What Vitest Trusts

1. **Developers and their infrastructure**
   The people who invoke Vitest and the environments they use (local workstations, CI runners, containers, the operating system, and the Node.js runtime) are all assumed to be under the developer's control and properly secured.

2. **Configuration and plugins**
   Everything in `vite.config.*` or `vitest.config.*`, the code they imports, CLI flags, and all plugins together with their transitive dependencies are treated as developer-authored and therefore trusted.

3. **Project files and dependencies**
   All source files, assets, and installed packages (including everything in `node_modules`) that the project references are trusted.

4. **Developer-configured network targets**
   Outbound connections the developer sets up explicitly (e.g., proxy rules in `server.proxy`) are trusted because the developer chose them.

### Dev Server

- Availability issues are not considered vulnerabilities.
- Files within the configured `server.fs` boundary (dev server) are expected to be accessible to clients.
- The existence of files is not hidden and cannot be hidden due to the development tool nature. Exposing file existence is not considered a vulnerability.
- Vulnerabilities caused by the code in Vite should be reported to [Vite's security advisory](https://github.com/vitejs/vite/security/policy).

### Preview Server and Build

- Vitest does not use Vite's preview server or builds files using Vite's `build` API. Any such vulnerabilities should be reported to Vite.

### Examples of Vulnerabilities (in scope)

- A crafted URL causes the dev server to return file contents outside the `server.fs` boundary.
  - `server.fs.deny` bypassed with a crafted HTTP request ([GHSA-8gvc-j273-4wm5](https://github.com/vitest-dev/vitest/security/advisories/GHSA-8gvc-j273-4wm5))
- Missing or bypassable origin / host validation allows a cross-origin page to access dev-server endpoints that can cause confidentiality or integrity issues.
- An unauthenticated WebSocket client injects HMR messages that execute arbitrary JavaScript on the developer's machine or bypasses built-in Commands API's protective layer.

### Examples of Non-Vulnerabilities (out of scope)

- Malicious Plugins or Dependencies (CWE-1357): Plugins, config files, and their dependency trees run with full trust during development. A compromised plugin that exfiltrates data or executes arbitrary code is a supply-chain concern for the project, not a Vitest vulnerability.
- Security Issues in the Application's Own Output: Flaws such as XSS, CSRF, or CSP misconfigurations in the bundled application are the responsibility of the application author. Vitest transforms code but does not guarantee the security properties of the output beyond the code it injects itself.
- Reading Files Within Configured Paths (CWE-427): Vitest is expected to read any file the project's configuration makes reachable. Pointing Vitest at a directory that contains sensitive material is a configuration choice, not a Vitest vulnerability.
- Attacker With Control Over Configuration (CWE-15): An attacker who can modify environment variables, CLI flags, or `vite.config.*`/`vitest.config.*` already controls a trusted input. Any consequences of that control are out of scope.
- Bugs in the Runtime or Operating System: Vulnerabilities in Node.js, the OS kernel, or other platform-level components are not considered a vulnerability in Vitest.

## Reporting a Vulnerability

To report a vulnerability, please open a private vulnerability report at https://github.com/vitest-dev/vitest/security. Please do not report upstream vulnerabilities unless the code is bundled in Vitest's package.

While the discovery of new vulnerabilities is rare, we also recommend always using the latest versions of Vitest and its official plugins to ensure your application remains as secure as possible.
