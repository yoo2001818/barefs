import MemoryDiskDriver from '../diskDriver/memory';
import byteArrayToHex from '../util/byteArrayToHex';
import makeDataPayload from '../util/makeDataPayload';
import DirectoryFileSystem from '../directoryFileSystem';

describe('DirectoryFileSystem', () => {
  let fs: DirectoryFileSystem;
  beforeEach(async () => {
    let driver = new MemoryDiskDriver();
    fs = await DirectoryFileSystem.mkfs(driver);
    await fs.init();
  });
  it('should handle creating / removing a file', async () => {
    let file = await fs.createFilePath('/hellowld.txt');
    await file.write(0, Buffer.from('Hello world', 'utf-8'));
    expect(byteArrayToHex(await file.read(0, 11)))
      .toEqual(byteArrayToHex(Buffer.from('Hello world')));
    let file2 = await fs.createFilePath('/something._at');
    await file2.write(0, Buffer.from('Hey', 'utf-8'));
    expect(byteArrayToHex(await file2.read(0, 3)))
      .toEqual(byteArrayToHex(Buffer.from('Hey')));
    await fs.unlinkPath('/hellowld.txt');
    let files = await fs.rootNode.readdir();
    expect(files).toEqual([
      { name: 'something._at', address: 5 },
    ]);
  });
});
