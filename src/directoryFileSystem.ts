import FileSystem from './fileSystem';
import DiskDriver from './diskDriver/interface';
import Directory from './directory';
import File from './file';
import INode, * as INodeUtil from './inode';

export default class DirectoryFileSystem extends FileSystem {
  createFileObject: (inode: INode) => File | Directory;
  rootNode: Directory;
  constructor(diskDriver: DiskDriver) {
    super(diskDriver);
    this.createFileObject = inode => {
      if (inode.type === 1) return new Directory(this, inode);
      return new File(this, inode);
    };
  }
  static async mkfs(diskDriver: DiskDriver): Promise<DirectoryFileSystem> {
    let inode = INodeUtil.createEmpty();
    inode.type = 1;
    await super.mkfs(diskDriver, inode);
    return new DirectoryFileSystem(diskDriver);
  }
  async init(): Promise<void> {
    await super.init();
    let node = await this.readFile(this.metadata.rootId);
    if (!(node instanceof Directory)) {
      throw new Error('Root node MUST be a directory');
    }
    this.rootNode = node;
  }
  async close(): Promise<void> {
    await super.close();
    this.rootNode.save();
  }
  async createDirectory(): Promise<Directory> {
    let directory = await this.createFile(1);
    if (!(directory instanceof Directory)) {
      throw new Error('Type 1 INode should be converted to Directory.');
    }
    return directory;
  }
}
