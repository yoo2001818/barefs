import INode, * as INodeUtil from './inode';
import File from './file';
import DiskDriver from './diskDriver/interface';
import Metadata, * as MetadataUtil from './metadata';
import BlockManager from './blockManager';
import INodeManager from './inodeManager';

export default class FileSystem {
  static BLOCK_SIZE = 4096;
  static INODE_SIZE = 128;
  diskDriver: DiskDriver;
  metadata: Metadata;
  blockManager: BlockManager;
  inodeManager: INodeManager;
  FileSystem(diskDriver: DiskDriver) {
    this.diskDriver = diskDriver;
  }
  static async mkfs(diskDriver: DiskDriver): Promise<FileSystem> {
    // Create new metadata and write inode block list / block bitmap
    let metadata: Metadata = {
      version: 1,
      bitmapId: 1,
      blockListId: 2,
    };
    await diskDriver.write(0, MetadataUtil.encode(metadata));
    // Populate empty 
    await diskDriver.write(128, INodeUtil.encode(INodeUtil.createEmpty()));
    await diskDriver.write(256, INodeUtil.encode(INodeUtil.createEmpty()));
  }
  async init(): Promise<void> {
    // Read metadata and read inode / block bitmap to buffer
    this.metadata = MetadataUtil.decode(await this.diskDriver.read(0, 128));
    this.inodeManager = new INodeManager(this);
    this.blockManager = new BlockManager(this);

    this.inodeManager.init(await this.readFile(this.metadata.blockListId));
    this.blockManager.init(await this.readFile(this.metadata.bitmapId));
  }
  async close(): Promise<void> { 
    // Write metadata to disk
    await this.diskDriver.write(0, MetadataUtil.encode(this.metadata));
  }
  async readBlock(
    id: number, position?: number, size?: number,
  ): Promise<Uint8Array> {
    let address = id * FileSystem.BLOCK_SIZE + (position || 0);
    return this.diskDriver.read(address, size || FileSystem.BLOCK_SIZE);
  }
  async writeBlock(
    id: number, position: number, buffer: Uint8Array,
  ): Promise<void> {
    let address = id * FileSystem.BLOCK_SIZE + (position || 0);
    return this.diskDriver.write(address, buffer);
  }
  async createFile(): Promise<File> {
    // Get free inode and wrap file
    let inode = await this.inodeManager.next();
    return new File(this, inode);
  }
  read(id: number): Promise<INode> {
    // Read inode from disk, or buffer (if in cache)
    return this.inodeManager.read(id);
  }
  async readFile(id: number): Promise<File> {
    // Read inode and wrap with file
    let inode = await this.inodeManager.read(id);
    return new File(this, inode);
  }
  async unlink(inode: INode): Promise<void> {
    // Delete inode and mark on the bitmap
  }
  async unlinkFile(file: File): Promise<void> {
    // Delete whole data node
  }
  setType(id: number, value: number): Promise<void> {
    // Set bitmap data
    return this.blockManager.setType(id, value);
  }
}
