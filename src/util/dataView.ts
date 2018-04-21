export default function createDataView(input: Uint8Array): DataView {
  return new DataView(input.buffer, input.byteOffset, input.byteLength);
}

export function createUint8Array(input: DataView): Uint8Array {
  return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}
