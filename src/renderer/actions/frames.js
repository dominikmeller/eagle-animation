import Dexie from 'dexie';

class BlobFramesDatabase extends Dexie {
  constructor() {
    super('BlobFramesDatabase');
    this.version(2).stores({
      frames: '++id,blob,extension',
    });
  }
}

const db = new BlobFramesDatabase();

export const createFrame = async (buffer, extension) => {
  await db.open();
  return db.frames.add({ buffer, extension });
};

let cachedUrls = {};

export const getFrameBlobUrl = async (id) => {
  if (cachedUrls[Number(id)]) {
    return cachedUrls[Number(id)];
  }
  await db.open();
  const frame = await db.frames.get(Number(id));
  if (!frame) {
    return null;
  }
  const blob = new Blob([frame.buffer], { type: `image/${frame?.extension?.replace('jpg', 'jpeg') || 'jpeg'}` });
  if (!blob) {
    return null;
  }
  cachedUrls[Number(id)] = URL.createObjectURL(blob);
  return cachedUrls[Number(id)];
};

export const getFrameBlob = async (id) => {
  await db.open();
  const frame = await db.frames.get(Number(id));
  if (!frame) {
    return null;
  }
  const blob = new Blob([frame.buffer], { type: `image/${frame?.extension?.replace('jpg', 'jpeg') || 'jpeg'}` });
  if (!blob) {
    return null;
  }
  return blob;
};
