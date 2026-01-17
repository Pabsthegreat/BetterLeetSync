#!/bin/bash
# Convert Logo.png to required icon sizes for Chrome extension

LOGO_FILE="Logo.png"

if [ ! -f "$LOGO_FILE" ]; then
  echo "Error: $LOGO_FILE not found!"
  echo "Please place your logo image as Logo.png in the extension/icons/ directory"
  exit 1
fi

echo "Converting Logo.png to icon sizes..."

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
  echo "Error: ImageMagick is not installed"
  echo ""
  echo "To install:"
  echo "  macOS: brew install imagemagick"
  echo "  Ubuntu: sudo apt-get install imagemagick"
  exit 1
fi

# Convert to different sizes
convert "$LOGO_FILE" -resize 16x16 icon16.png
convert "$LOGO_FILE" -resize 48x48 icon48.png
convert "$LOGO_FILE" -resize 128x128 icon128.png

echo "✓ Icons created successfully!"
echo "  - icon16.png (16x16)"
echo "  - icon48.png (48x48)"
echo "  - icon128.png (128x128)"
