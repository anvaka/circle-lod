module.exports = {
  encodeQuadNameToBinary: encodeQuadNameToBinary,
  decodeQuadNameFromBinary: decodeQuadNameFromBinary
};

function encodeQuadNameToBinary(quadNameString) {
  var result = 0;
  // first four bits represent string length
  var bitOffset = 4;
  var nameLength = quadNameString.length - 1;
  result |= nameLength
  // TODO: Validate quad length
  if (nameLength > 14) {
    // why 14? Each digit is encoded in two bits:
    // 00 - 0
    // 01 - 1
    // 10 - 2
    // 11 - 3
    // thus 14 * 2 = 28 - 28 bits for the name part + 4 bits for the length
    // descriptor.
    throw new Error('Name is too long to be encoded: ' + quadNameString);
  }

  // reminder of the 32 bit word is encoded quad name:
  for (var i = 1; i < nameLength + 1; ++i) {
    // name always starts with 0, so we start from index 1
    switch(quadNameString[i]) {
      case '0':
        break; // no need to write 00
      case '1':
        result |= (1 << bitOffset);
        break;
      case '2':
        result |= (1 << (bitOffset + 1));
        break;
      case '3':
        result |= (1 << bitOffset);
        result |= (1 << (bitOffset + 1));
        break;
      default:
        throw new Error('Invalid quad name: ' + quadNameString);
    }

    bitOffset += 2;
  }

  return result;
}

function decodeQuadNameFromBinary(quadNameNumber) {
  var result = '0';
  var quadNameLength = quadNameNumber & 15;
  var maxBitOffset = 4 + quadNameLength * 2;
  var index = 4;

  while (index < maxBitOffset) {
    var twoBits = getTwoBitsAt(index, quadNameNumber);
    result += twoBits;
    index += 2;
  }

  return result;
}

function getTwoBitsAt(index, number) {
  var mask = 3; // 11 in binary
  var twoBits = (number >> index) & mask;

  return twoBits;
}

// var input = '0100000301';
// console.log(input);
// var encoded = encodeQuadNameToBinary(input);
// console.log(decodeQuadNameFromBinary(encoded));
