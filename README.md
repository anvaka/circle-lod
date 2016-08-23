# circle-lod

Level of detail algorithm to render millions of circles. Feel free to ignore this.
It's just a playground.


## Data format

These notes are for my future self.

### `tree.bin`

Binary file. Contains index information for a tree.

* `4*4 bytes` - Tree dimensions; `left/top/right/bottom` - int little endian per
  record.

* `tree index` - binary encoded tree. Each node takes 4 bits. The tree is pre-order
  traversed with DFS, on each node visit 4 bits are consumed. See `lib/binaryDumpTree.js`
  for the encoding/decoding.

* `terminal node index` - immediately follows the tree index. The node is terminal
  if it's sparsely populated. If node is terminal, then its data and data of its
  children is stored inside one file. The main purpose of terminal nodes is to avoid
  excessive FS cost, and save on required network requests. Terminal nodes are
  written as a sequence of int32, binary encoded names. See `lib/binaryQuadName.js`

### Binary quad name

Each quad at depth `[0 .. 2^14]` can be encoded in binary 32-bit record. The tree
Tree index uses this encoding format to store terminal nodes array.

* `bits [0..3]` - node's depth
* `bits [4..31]` - node path. Quad name can consist only from `0`, `1`, `2` or `3`.
Thus, each path element towards quad is encoded in two bits.

See `lib/binaryQuadName.js`

# license

MIT
