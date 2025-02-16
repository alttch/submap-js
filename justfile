all:
  @echo "Select target"

test:
  bun test

pub:
  rci x submap-js
