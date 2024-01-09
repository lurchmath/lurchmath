
echo 'Deleting old peggy source for: LurchMath-to-LaTeX'
rm lurch-to-tex.peggy

echo ' Downloading peggy source for: LurchMath-to-LaTeX'
wget --quiet https://raw.githubusercontent.com/lurchmath/lde/compact-validation-test/src/experimental/parsers/lurch-to-tex.peggy

echo '   Deleting old JS source for: LurchMath-to-LaTeX'
rm lurch-to-tex.js

echo '   Compiling peggy source for: LurchMath-to-LaTeX'
node ../node_modules/peggy/bin/peggy.js --cache --format es \
    --output lurch-to-tex.js lurch-to-tex.peggy

echo 'Deleting old peggy source for: LurchMath-to-putdown'
rm lurch-to-putdown.peggy

echo ' Downloading peggy source for: LurchMath-to-putdown'
wget --quiet https://raw.githubusercontent.com/lurchmath/lde/compact-validation-test/src/experimental/parsers/lurch-to-putdown.peggy

echo '   Deleting old JS source for: LurchMath-to-putdown'
rm lurch-to-putdown.js

echo '   Compiling peggy source for: LurchMath-to-putdown'
node ../node_modules/peggy/bin/peggy.js --cache --format es \
    --output lurch-to-putdown.js lurch-to-putdown.peggy

echo 'Results:'
ls -al \
    lurch-to-tex.peggy \
    lurch-to-tex.js \
    lurch-to-putdown.peggy \
    lurch-to-putdown.js
