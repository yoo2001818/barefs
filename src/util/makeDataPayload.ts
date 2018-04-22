export default function makeDataPayload(
  seed: number, size: number,
): Uint8Array {
  let buffer = new ArrayBuffer(size);
  let dataView = new DataView(buffer);
  for (let i = 0; i + 3 < size; i += 4) {
    dataView.setInt32(i, seed + (i >> 2), true);
  }
  return new Uint8Array(buffer);
}
