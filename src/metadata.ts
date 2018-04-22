import bossam from 'bossam';

export default interface Metadata {
  version: number;
  bitmapId: number;
  blockListId: number;
  rootId: number;
}

const namespace = bossam(`
  struct Metadata = Padded<{
    0xAB531B98: u32,
    version: u32,
    bitmapId: u64,
    blockListId: u64,
    rootId: u64,
  }, 128>;
`);

export function encode(metadata: Metadata): Uint8Array {
  return namespace['Metadata'].encode<Metadata>(metadata);
}

export function decode(buffer: Uint8Array): Metadata {
  return namespace['Metadata'].decode<Metadata>(buffer);
}
