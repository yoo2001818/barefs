import fuse from 'fuse-bindings';

import NodeFSWrapper from './fuseFSWrapper';
import DirectoryFileSystem from './directoryFileSystem';
import NodejsDiskDriver from './diskDriver/nodejs';
import MemoryDiskDriver from './diskDriver/memory';

(async () => {
  let memory = new MemoryDiskDriver();
  /*
  await memory.open();
  if (memory.isNew) {
    await DirectoryFileSystem.mkfs(memory);
  }
  */
  await DirectoryFileSystem.mkfs(memory);
  let fs = new DirectoryFileSystem(memory);
  await fs.init();
  let wrapper = NodeFSWrapper(fs);

  let dir = process.argv[2];

  fuse.mount(dir, wrapper, (err: any) => {
    if (err) {
      console.error(err);
    } else {
      console.log('Mounted on ' + dir);
    }
  });

  process.on('SIGINT', () => {
    fuse.unmount(dir, (err: any) => {
      if (err) console.error(err);
      process.exit(0);
    });
  });
})();
