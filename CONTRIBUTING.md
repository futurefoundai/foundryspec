# Contributing to FoundrySpec

First off, thank you for considering contributing to FoundrySpec! It's people like you that make tools like this great.

## 📜 CLA Implementation

FoundrySpec follows an **Open Core** model. The core platform is licensed under **AGPLv3**, but we also maintain an Enterprise edition.

To ensure we can legally defend the project and offer commercial licenses to support its development, **all contributors must sign our Contributor License Agreement (CLA)**.

- **What it says**: You keep your copyright, but grant us permission to use your code in our products.
- **How to sign**: Seamlessly via our CLA bot. Just submit a Pull Request, and the bot will ask you to comment `I have read the CLA Document and I hereby sign the CLA` to accept.

## 🛠 Workflow

1.  **Fork** the repo on GitHub.
2.  **Clone** the project to your own machine.
3.  **Create a Branch** for your feature or bug fix.
4.  **Commit** your changes to your own branch.
5.  **Push** your work back to your fork.
6.  **Submit a Pull Request** so that we can review your changes.

## 🧪 Testing

We use `vitest` for testing. Please ensure all tests pass before submitting.

```bash
npm test
```

## 🏗 Monorepo Structure

- `packages/core`: The main AGPLv3 open source code.
- `packages/enterprise`: (Private) Commercial extensions. You likely won't see this folder.

Thank you for your help!
