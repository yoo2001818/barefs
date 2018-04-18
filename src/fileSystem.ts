import INode from './inode';
import File from './file';
import DiskDriver from './diskDriver/interface';
import MetadataType, * as Metadata from './metadata';
import BlockManager from './blockManager';
import INodeManager from './inodeManager';

export default class FileSystem {
  static BLOCK_SIZE = 4096;
  static INODE_SIZE = 128;
  diskDriver: DiskDriver;
  metadata: MetadataType;
  blockManager: BlockManager;
  inodeManager: INodeManager;
  FileSystem(diskDriver: DiskDriver) {
    this.diskDriver = diskDriver;
  }
  static async mkfs(diskDriver: DiskDriver): Promise<FileSystem> {
    // Create new metadata and write inode block list / block bitmap
    let metadata: MetadataType = {
      version: 1,
      bitmapId: 1,
      blockListId: 2,
    };
    await diskDriver.write(0, Metadata.encode(metadata));
  }
  async init(): Promise<void> {
    // Read metadata and read inode / block bitmap to buffer
    this.metadata = Metadata.decode(await this.diskDriver.read(0, 128));
  }
  async close(): Promise<void> { 
    // Write metadata to disk
    await this.diskDriver.write(0, Metadata.encode(this.metadata));
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
  }
  async read(id: number): Promise<INode> {
    // Read inode from disk, or buffer (if in cache)
  }
  async readFile(id: number): Promise<File> {
    // Read inode and wrap with file
  }
  async unlink(inode: INode): Promise<void> {
    // Delete inode and mark on the bitmap
  }
  async unlinkFile(file: File): Promise<void> {
    // Delete whole data node
  }
  async setBlockType(id: number, value: number): Promise<void> {
    // Set bitmap data
  }
}
