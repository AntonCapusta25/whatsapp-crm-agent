#!/bin/bash

# Ensure we are logged in
echo "Checking Fly.io authentication status..."
if ! fly auth whoami &>/dev/null; then
    echo "Your Fly session is expired or not logged in. Opening browser to login..."
    fly auth login
fi

# Ask for app name
APP_NAME=$(grep -oE '^app = "[^"]+"' fly.toml | head -n 1 | cut -d'"' -f2)
echo "Found app name in fly.toml: $APP_NAME"
read -p "Do you want to use this app name? (y/n): " confirm_app
if [ "$confirm_app" != "y" ] && [ "$confirm_app" != "Y" ]; then
    read -p "Enter your desired unique Fly app name: " APP_NAME
    # Update fly.toml
    sed -i '' "s/^app = \".*\"/app = \"$APP_NAME\"/" fly.toml
    echo "Updated fly.toml with app name: $APP_NAME"
fi

# Create app if it doesn't exist
echo "Ensuring Fly app '$APP_NAME' is registered..."
fly apps create "$APP_NAME" &>/dev/null || echo "App '$APP_NAME' already exists or is ready."

# Parse secrets from .env
if [ -f .env ]; then
    echo "Setting secrets from .env on Fly.io..."
    SECRETS=()
    while IFS= read -r line || [ -n "$line" ]; do
        # Ignore comments and empty lines
        [[ "$line" =~ ^#.*$ ]] && continue
        [[ -z "$line" ]] && continue
        # Only add valid KEY=VALUE lines
        if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*=.*$ ]]; then
            SECRETS+=("$line")
        fi
    done < .env
    
    if [ ${#SECRETS[@]} -gt 0 ]; then
        fly secrets set "${SECRETS[@]}"
    fi
else
    echo "⚠️ No .env file found to copy secrets from."
fi

# Deploy
echo "Deploying to Fly.io..."
fly deploy
