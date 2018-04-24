import MemoryDiskDriver from '../diskDriver/memory';
import FileSystem from '../fileSystem';
import byteArrayToHex from '../util/byteArrayToHex';
import makeDataPayload from '../util/makeDataPayload';

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
    expect(byteArrayToHex(await file.read(0, 13)))
      .toEqual(byteArrayToHex(Buffer.from('Hello, world!')));
    expect(byteArrayToHex(await file2.read(0, 4)))
      .toEqual(byteArrayToHex(Buffer.from('Nope')));
    let largeChunk = makeDataPayload(0x1919, 4192);
    await file.write(13, largeChunk);
    expect(file.length).toBe(13 + 4192);
    let largeChunk2 = makeDataPayload(0x5353, 50000);
    await file2.write(40, largeChunk2);
    expect(file2.length).toBe(40 + 50000);
    expect(await file.read(13, 4192)).toEqual(largeChunk);
    expect(await file2.read(40, 50000)).toEqual(largeChunk2);
  });
  it('should properly truncate file', async () => {
    let driver = new MemoryDiskDriver();
    let fs = await FileSystem.mkfs(driver);
    await fs.init();
    let file = await fs.createFile();
    let largeChunk = makeDataPayload(0x5353, 5000000);
    await file.write(0, largeChunk);
    expect(file.length).toBe(5000000);
    await file.truncate(0);
    expect(file.length).toBe(0);
    expect(await fs.blockManager.next()).toBe(4);
  });
  it('should properly remove file', async () => {
    let driver = new MemoryDiskDriver();
    let fs = await FileSystem.mkfs(driver);
    await fs.init();
    let file = await fs.createFile();
    let file2 = await fs.createFile();
    await file.write(0, Buffer.from('hey'));
    expect(file.length).toBe(3)
    await fs.unlinkFile(file);
    expect((await fs.inodeManager.next()).id).toBe(file.id);
    expect((await fs.inodeManager.next()).id).toBe(file2.id + 1);
  });
});
