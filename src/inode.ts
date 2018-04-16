import bossam from 'bossam';

export default interface INode {
  id: number;
  length: number;
  pointers: number[];
  single: number;
  double: number;
  triple: number;
}

const namespace = bossam(`
  struct INode = Padded<{
    length: u64,
    pointers: [u64; 12],
    single: u64,
    double: u64,
    triple: u64,
  }, 128>;
`);

export function encode(inode: INode): Uint8Array {
  return namespace['INode'].encode<INode>(inode);
}

export function decode(id: number, buffer: Uint8Array): INode {
  let result = namespace['INode'].decode<INode>(buffer);
  result.id = id;
  return result;
}
