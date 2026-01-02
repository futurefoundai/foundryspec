# FoundrySpec Security & Trust Boundaries

To maintain integrity when using FoundrySpec across multiple repositories and AI agents.

## 1. Trust Boundaries
- **External Specs**: Data pulled via `foundryspec pull` is considered **untrusted**. The build engine must treat external Mermaid files as static text only and never execute code from them.
- **Git URLs**: The CLI should only execute `git clone` on URLs provided by the user.

## 2. Access Control
- **GitHub Tokens**: Deployment actions (GitHub Actions) must use scoped secrets (`GITHUB_TOKEN` or repository-specific secrets) with minimum necessary permissions (e.g., `contents: write` for GitHub Pages).

## 3. Data Integrity
- **Validation**: `foundryspec build` should validate that the `foundry.config.json` and external specs do not exceed safe file size limits or contain malicious path traversals.
