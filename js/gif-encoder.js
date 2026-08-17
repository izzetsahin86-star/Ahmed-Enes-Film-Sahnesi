export class GifEncoder {
  constructor(width, height, { loop = 0 } = {}) {
    if (!width || !height) throw new Error('GIF boyutu geçersiz.');
    this.width = width;
    this.height = height;
    this.bytes = [];
    this.writeHeader(loop);
  }

  writeHeader(loop) {
    writeAscii(this.bytes, 'GIF89a');
    writeU16(this.bytes, this.width);
    writeU16(this.bytes, this.height);
    this.bytes.push(0xF7, 0x00, 0x00);
    for (let i = 0; i < 256; i += 1) {
      const r = (i >> 5) & 0x07;
      const g = (i >> 2) & 0x07;
      const b = i & 0x03;
      this.bytes.push(Math.round((r / 7) * 255), Math.round((g / 7) * 255), Math.round((b / 3) * 255));
    }
    this.bytes.push(0x21, 0xFF, 0x0B);
    writeAscii(this.bytes, 'NETSCAPE2.0');
    this.bytes.push(0x03, 0x01, loop & 0xFF, (loop >> 8) & 0xFF, 0x00);
  }

  addFrame(imageData, delayMs = 100) {
    if (!imageData?.data || imageData.width !== this.width || imageData.height !== this.height) throw new Error('GIF karesi beklenen boyutta değil.');
    const delay = Math.max(1, Math.min(65535, Math.round(delayMs / 10)));
    this.bytes.push(0x21, 0xF9, 0x04, 0x00, delay & 0xFF, (delay >> 8) & 0xFF, 0x00, 0x00);
    this.bytes.push(0x2C);
    writeU16(this.bytes, 0); writeU16(this.bytes, 0);
    writeU16(this.bytes, this.width); writeU16(this.bytes, this.height);
    this.bytes.push(0x00);
    const indices = quantize332(imageData.data);
    const compressed = lzwEncode(indices, 8);
    this.bytes.push(0x08);
    for (let offset = 0; offset < compressed.length; offset += 255) {
      const size = Math.min(255, compressed.length - offset);
      this.bytes.push(size);
      for (let i = 0; i < size; i += 1) this.bytes.push(compressed[offset + i]);
    }
    this.bytes.push(0x00);
  }

  finish() {
    this.bytes.push(0x3B);
    return new Blob([new Uint8Array(this.bytes)], { type: 'image/gif' });
  }
}

function quantize332(rgba) {
  const out = new Uint8Array(rgba.length / 4);
  for (let p = 0, i = 0; p < out.length; p += 1, i += 4) out[p] = (rgba[i] & 0xE0) | ((rgba[i + 1] & 0xE0) >> 3) | ((rgba[i + 2] & 0xC0) >> 6);
  return out;
}

function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let nextCode = endCode + 1;
  let codeSize = minCodeSize + 1;
  let dict = new Map();
  const output = [];
  let currentByte = 0;
  let bitCount = 0;
  const writeCode = code => {
    currentByte |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(currentByte & 0xFF);
      currentByte >>>= 8;
      bitCount -= 8;
    }
  };
  const reset = () => { dict = new Map(); nextCode = endCode + 1; codeSize = minCodeSize + 1; };
  writeCode(clearCode);
  if (!indices.length) {
    writeCode(endCode);
    if (bitCount > 0) output.push(currentByte & 0xFF);
    return new Uint8Array(output);
  }
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i += 1) {
    const value = indices[i];
    const key = (prefix << 8) | value;
    const found = dict.get(key);
    if (found !== undefined) { prefix = found; continue; }
    writeCode(prefix);
    if (nextCode < 4096) {
      dict.set(key, nextCode);
      nextCode += 1;
      if (nextCode === (1 << codeSize) && codeSize < 12) codeSize += 1;
    } else {
      writeCode(clearCode);
      reset();
    }
    prefix = value;
  }
  writeCode(prefix);
  writeCode(endCode);
  if (bitCount > 0) output.push(currentByte & 0xFF);
  return new Uint8Array(output);
}
function writeAscii(target, text) { for (let i = 0; i < text.length; i += 1) target.push(text.charCodeAt(i)); }
function writeU16(target, value) { target.push(value & 0xFF, (value >> 8) & 0xFF); }
