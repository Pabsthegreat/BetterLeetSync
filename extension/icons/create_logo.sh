#!/bin/bash
# Simple script to create BetterLeetSync logo
# Creates a black and yellow themed logo

echo "Creating BetterLeetSync logo..."

# Create 16x16 icon (black with yellow accent)
convert -size 16x16 xc:'#1a1a1a' \
  -fill '#FFA116' -draw 'rectangle 3,3 12,12' \
  -fill '#1a1a1a' -draw 'rectangle 5,5 10,10' \
  extension/icons/icon16.png 2>/dev/null

# Create 48x48 icon
convert -size 48x48 xc:'#1a1a1a' \
  -fill '#FFA116' -draw 'roundrectangle 8,8 40,40 6,6' \
  -fill '#1a1a1a' -draw 'roundrectangle 12,12 36,36 4,4' \
  -fill '#FFA116' -draw 'rectangle 18,20 30,22' \
  -fill '#FFA116' -draw 'rectangle 18,26 30,28' \
  extension/icons/icon48.png 2>/dev/null

# Create 128x128 icon
convert -size 128x128 xc:'#1a1a1a' \
  -fill '#FFA116' -draw 'roundrectangle 16,16 112,112 12,12' \
  -fill '#1a1a1a' -draw 'roundrectangle 24,24 104,104 8,8' \
  -fill '#FFA116' -draw 'rectangle 40,48 88,56' \
  -fill '#FFA116' -draw 'rectangle 40,64 88,72' \
  -fill '#FFA116' -draw 'rectangle 40,80 72,88' \
  extension/icons/icon128.png 2>/dev/null

# If ImageMagick is not available, provide instructions
if [ $? -ne 0 ]; then
  echo "ImageMagick not found. Please install it or create icons manually."
  echo ""
  echo "For macOS: brew install imagemagick"
  echo "For Ubuntu: sudo apt-get install imagemagick"
  echo ""
  echo "Or create icons manually with these specs:"
  echo "- Black background (#1a1a1a)"
  echo "- Yellow/orange accent (#FFA116)"
  echo "- Sizes: 16x16, 48x48, 128x128"
else
  echo "✓ Icons created successfully!"
fi
