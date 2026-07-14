#!/bin/bash

# Run each test file in its own process to avoid module mocking interference
FAILED=0

for file in $(find lib app -name "*.test.ts" | sort); do
  bun test "$file" || FAILED=1
done

exit $FAILED
