import INode from './inode';
import FileSystem from './fileSystem';

type INodePointer = number | number[];

const BLOCK_ENTRIES = FileSystem.BLOCK_SIZE / 4;

function getINodeAddress(address: number): INodePointer {
  // Get initial inode address for the data address.
  let blockId = Math.floor(address / FileSystem.BLOCK_SIZE);
  if (blockId < 12) return blockId;
  blockId -= 12;
  if (blockId < BLOCK_ENTRIES) return [blockId];
  blockId -= BLOCK_ENTRIES;
  if (blockId < BLOCK_ENTRIES * BLOCK_ENTRIES) {
    return [(blockId / BLOCK_ENTRIES) | 0, blockId % BLOCK_ENTRIES];
  }
  blockId -= BLOCK_ENTRIES * BLOCK_ENTRIES;
  if (blockId < BLOCK_ENTRIES * BLOCK_ENTRIES * BLOCK_ENTRIES) {
    return [
      (blockId / BLOCK_ENTRIES / BLOCK_ENTRIES) | 0,
      ((blockId / BLOCK_ENTRIES) | 0) % BLOCK_ENTRIES,
      blockId % BLOCK_ENTRIES,
    ];
  }
  throw new Error('The file cannot be addressed since it is too large.');
}
export default class File {
  static FILE_TYPE = 1;

  fs: FileSystem;
  inode: INode;

  constructor(fs: FileSystem, inode: INode) {
    this.fs = fs;
    this.inode = inode;
  }
  get id(): number {
    return this.inode.id;
  }
  get length(): number {
    return this.inode.length;
  }
  async read(
    position: number, size: number, output?: Uint8Array,
  ): Promise<Uint8Array> {
    let address: INodePointer = getINodeAddress(position);
    if (typeof address === 'number') {
      return this.fs.diskDriver.read(
        this.inode.pointers[address] * FileSystem.BLOCK_SIZE,
        FileSystem.BLOCK_SIZE);
    } else {
      // Descend to the positioning node..
    }
  }
  async write(
    position: number, input: Uint8Array, size?: number,
  ): Promise<void> {
  }
  async truncate(size: number): Promise<void> {

  }
}
