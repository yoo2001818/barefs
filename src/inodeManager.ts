import File from './file';
import INode from './inode';
import FileSystem from './fileSystem';

export type BlockType = number;

export default class INodeManager {
  fs: FileSystem;
  blockListFile: File;

  constructor(fs: FileSystem, blockListFile: File) {
    this.fs = fs;
    this.blockListFile = blockListFile;
  }

  async read(id: number): Promise<INode> {
    return null;
  }

  async write(id: number, inode: INode): Promise<void> {

  }

  async next(): Promise<INode> {
    return null;
  }
}
