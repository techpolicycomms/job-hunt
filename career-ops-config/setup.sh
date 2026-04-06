#!/bin/bash
# setup.sh — copies your personal career-ops files into the submodule after cloning.
# Run once after: git clone && git submodule update --init

echo "Copying personal files into career-ops..."
cp "$(dirname "$0")/profile.yml"  "$(dirname "$0")/../career-ops/config/profile.yml"
cp "$(dirname "$0")/cv.md"        "$(dirname "$0")/../career-ops/cv.md"
cp "$(dirname "$0")/_profile.md"  "$(dirname "$0")/../career-ops/modes/_profile.md"
echo "Done. Now run: cd career-ops && npm install && npx playwright install chromium"
