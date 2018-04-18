import bossam from 'bossam';

export default interface INode {
  id: number;
  length: number;
  pointers: number[];
  jumps: number[];
  dirty: boolean;
}

const namespace = bossam(`
  struct INode = Padded<{
    length: u64,
    pointers: [u64; 12],
    jumps: [u64; 3],
  }, 128>;
`);

export function encode(inode: INode): Uint8Array {
  return namespace['INode'].encode<INode>(inode);
}

export function decode(id: number, buffer: Uint8Array): INode {
  let result = namespace['INode'].decode<INode>(buffer);
  result.id = id;
  resule.dirty = false;
  return result;
}
