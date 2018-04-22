export default function byteArrayToHex(buffer: Uint8Array): string {
  return Array.prototype.map.call(buffer,
    (x: number) => ('00' + x.toString(16)).slice(-2)).join('');
}

export function byteArrayFromHex(str: string): Uint8Array {
  let buf = new Uint8Array(str.length / 2);
  for (let i = 0; i < buf.length; ++i) {
    buf[i] = parseInt(str.slice(i * 2, i * 2 + 2), 16);
  }
  return buf;
}
