#!/bin/bash
set -e

# Core Release Script
# Builds, verifies, and publishes the Core package to the Public Registry.

echo "🚀 Preparing Core Release..."

# 1. Build Core
echo "📦 Building packages/core..."
npm run build -w packages/core

# 2. Run Tests
echo "🧪 Running Tests..."
npm run test -w packages/core

# 3. Publish
# Note: In CI, we would check the version or use semantic-release.
# For local use, this does a dry-run check or actual publish.

if [ "$1" == "--dry-run" ]; then
  echo "👀 Dry Run: Packing tarball..."
  npm pack -w packages/core
else
  echo "🚀 Publishing to Public NPM..."
  npm publish -w packages/core --access public
fi
