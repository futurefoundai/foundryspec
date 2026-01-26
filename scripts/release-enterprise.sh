#!/bin/bash
set -e

# Enterprise Release Script
# Builds and publishes the Enterprise package to a Private Registry.

echo "💼 Preparing Enterprise Release..."

# 1. Build Enterprise
echo "📦 Building packages/enterprise..."
npm run build -w packages/enterprise

# 2. Package (No NPM Registry yet)
echo "📦 Packing Enterprise Tarball..."
npm pack -w packages/enterprise

echo "✅ Enterprise tarball created in root directory."
echo "   You can distribute this .tgz file manually or via git."

# Future: Publish to Private Registry
# npm publish -w packages/enterprise --registry https://npm.pkg.github.com
