import MemoryDiskDriver from '../../diskDriver/memory';
import makeDataPayload from '../../util/makeDataPayload';

describe('MemoryDiskDriver', () => {
  let driver: MemoryDiskDriver;
  beforeEach(() => {
    driver = new MemoryDiskDriver();
  });
  it('should expand on demand', async () => {
    let payload = makeDataPayload(0xdeadcafe, 8198);
    await driver.write(13, payload);
    await driver.write(20000, Buffer.from('Lorem ipsum something'));
    expect(await driver.read(13, 8198)).toEqual(payload);
    expect(await driver.read(20000, 5)).toEqual(Buffer.from('Lorem'));
  });
  it('should throw an error if overflown', async () => {
    let payload = makeDataPayload(0xdeadcafe, 8198);
    await driver.write(13, payload);
    await expect(driver.read(10000, 4)).rejects.toEqual(
      new Error('Memory disk out of bounds'));
  });
});
