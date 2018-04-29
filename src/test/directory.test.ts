import MemoryDiskDriver from '../diskDriver/memory';
import FileSystem from '../fileSystem';
import Directory from '../directory';

describe('Directory', () => {
  it('should read/write directories', async () => {
    let driver = new MemoryDiskDriver();
    let fs = await FileSystem.mkfs(driver);
    await fs.init();
    let file = await fs.createFile();
    await file.write(0, Buffer.from('Hello, world!'));
    expect(file.length).toBe(13);
    expect(file.id).toBe(3);
    let dir = new Directory(fs, (await fs.createFile()).inode);
    await dir.createFile('hello', file);
    await dir.save();
    await dir.reload();
    expect((await dir.resolve('hello')).id).toBe(3);
    await dir.unlinkFile('hello');
    await dir.save();
    await dir.reload();
    expect(await dir.resolve('hello')).toBe(null);
  });
});
