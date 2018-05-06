import bossam from 'bossam';

export default interface INode {
  id: number;
  length: number;
  type: number;
  uid: number;
  gid: number;
  permission: number;
  ctime: number;
  mtime: number;
  reserved: number;
  pointers: number[];
  jumps: number[];
  dirty: boolean;
}

const namespace = bossam(`
  struct INode = Padded<{
    length: u64,
    type: u16,
    uid: u16,
    gid: u16,
    permission: u16,
    ctime: u64,
    mtime: u64,
    reserved: u48,
    pointers: [u48; 12],
    jumps: [u48; 3],
  }, 128>;
`);

export function encode(inode: INode): Uint8Array {
  return namespace['INode'].encode<INode>(inode);
}

export function decode(id: number, buffer: Uint8Array): INode {
  let result = namespace['INode'].decode<INode>(buffer);
  result.id = id;
  result.dirty = false;
  return result;
}

export function createEmpty(): INode {
  return {
    id: 0,
    length: 0,
    type: 0,
    uid: 0,
    gid: 0,
    permission: 0,
    ctime: Date.now(),
    mtime: 0,
    reserved: 0,
    pointers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    jumps: [0, 0, 0],
    dirty: true,
  };
}
