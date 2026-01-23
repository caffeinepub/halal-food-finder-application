#!/bin/bash
set -e

echo "🚀 Starting deployment process..."

# Setup Motoko compiler symlinks to use dfx-bundled compiler
if [ ! -x "/home/ubuntu/.motoko/moc/0.16.3-implicits-26/bin/moc" ]; then
  echo "🔗 Setting up Motoko compiler symlinks..."
  DFX_CACHE=$(dfx cache show)
  mkdir -p /home/ubuntu/.motoko/moc/0.16.3-implicits-26/bin
  ln -sf "$DFX_CACHE/moc" /home/ubuntu/.motoko/moc/0.16.3-implicits-26/bin/moc
  ln -sf "$DFX_CACHE/base" /home/ubuntu/.motoko/base/MOTOKO_BASE_LIB_VERSION
  echo "✅ Motoko compiler symlinks created"
else
  echo "✅ Motoko compiler already configured"
fi

# Start dfx replica if not already running
echo "🔧 Starting dfx replica..."
dfx start --background || echo "dfx replica already running or failed to start"

# Run build script
echo "🔨 Running build script..."
bash src/build.sh

# Deploy backend canister
echo "📦 Deploying backend canister..."
dfx deploy backend

# Get backend canister ID
BACKEND_ID=$(dfx canister id backend)
echo "✅ Backend deployed with ID: $BACKEND_ID"

BACKEND_HOST="http://localhost:4943"

# Update env.json with backend canister ID
echo "📝 Updating env.json with backend canister ID..."
cat > src/frontend/env.json <<EOF
{
  "backend_host": "$BACKEND_HOST",
  "backend_canister_id": "$BACKEND_ID"
}
EOF

# Rebuild frontend with environment variable
echo "🔨 Building frontend with canister IDs..."
export CANISTER_ID_BACKEND=$BACKEND_ID
cd src/frontend
pnpm run build:skip-bindings
cd ../..

# Deploy frontend canister
echo "📦 Deploying frontend canister..."
dfx deploy frontend

# Get frontend canister ID
FRONTEND_ID=$(dfx canister id frontend)

echo ""
echo "✨ Deployment complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Backend Canister ID:  $BACKEND_ID"
echo "Frontend Canister ID: $FRONTEND_ID"
echo ""
echo "🌐 Access your application at:"
if [ "$DFX_NETWORK" = "ic" ]; then
  echo "   https://$FRONTEND_ID.ic0.app"
else
  echo "   http://$FRONTEND_ID.localhost:4943"
  echo "   or"
  echo "   $BACKEND_HOST?canisterId=$FRONTEND_ID"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔄 Keeping container alive... Press Ctrl+C to stop"
tail -f /dev/null

