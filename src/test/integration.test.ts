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
    expect(await file.read(13, 4192)).toEqual(largeChunk);
  });
});
