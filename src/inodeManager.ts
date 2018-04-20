import File from './file';
import INode, { encode, decode, createEmpty } from './inode';
import FileSystem from './fileSystem';

export type BlockType = number;

export default class INodeManager {
  fs: FileSystem;
  blockListFile: File;

  constructor(fs: FileSystem) {
    this.fs = fs;
  }

  init(blockListFile: File): void {
    this.blockListFile = blockListFile;
  }

  async read(id: number): Promise<INode> {
    // TODO Get offset from block list!!!
    return decode(id, await this.fs.diskDriver.read(id * 128, 128));
  }

  async write(id: number, inode: INode): Promise<void> {
    // TODO Get offset from block list!!!
    // Also, if the block is full, allocate new block
    return this.fs.diskDriver.write(id * 128, encode(inode));
  }

  async next(): Promise<INode> {
    // TODO Since all blocks are placed on the bitmap, get the first inode block
    // with empty node.
    return createEmpty();
  }
}
