import FileSystem from './fileSystem';
import DiskDriver from './diskDriver/interface';
import Directory from './directory';
import File from './file';
import INode, * as INodeUtil from './inode';

function splitPath(path: string): string[] {
  return path.split('/');
}

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
  async resolvePath(path: string): Promise<File> {
    let paths = splitPath(path);
    let node: File = this.rootNode;
    for (let slice of paths) {
      if (!(node instanceof Directory)) {
        throw new Error('Cannot descend into file node');
      }
      let result = await node.resolve(slice);
      if (result == null) {
        throw new Error(slice + ' is not a valid inode');
      }
      node = result;
    }
    return node;
  }
  async createFilePath(path: string, type: number): Promise<INode> {

  }
  async createDirectoryPath(path: string): Promise<Directory> {
    let directory = await this.createFilePath(path, 1);
    if (!(directory instanceof Directory)) {
      throw new Error('Type 1 INode should be converted to Directory.');
    }
    return directory;
  }
}
