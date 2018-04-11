import MemoryDiskDriver from '../diskDriver/memory';
import FileSystem from '../fileSystem';

describe('FileSystem', () => {
  it('should handle regular use case', async () => {
    let driver = new MemoryDiskDriver();
    let fs = await FileSystem.mkfs(driver);
    await fs.init();
    let file = await fs.createFile();
    await file.write(0, Buffer.from('Hello, world!'));
    expect(file.length).toBe(13);
    // This might be changed
    expect(file.id).toBe(3);
    let file2 = await fs.createFile();
    await file2.write(0, Buffer.from('Nope'));
    expect(file2.length).toBe(4);
    // This might be changed
    expect(file2.id).toBe(4);
    expect(file.read(0, 13)).toEqual(Buffer.from('Hello, world!'));
    expect(file2.read(0, 4)).toEqual(Buffer.from('Nope'));
  });
});
