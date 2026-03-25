import archiver from 'archiver';

type ArchiveEntry = {
  name: string;
  path?: string;
  data?: Buffer | string;
};

export async function buildZipArchive(entries: ArchiveEntry[]) {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('warning', (error) => {
      if (error?.code === 'ENOENT') return;
      reject(error);
    });
    archive.on('error', (error) => reject(error));
    archive.on('end', () => resolve(Buffer.concat(chunks)));

    for (const entry of entries) {
      if (entry.path) {
        archive.file(entry.path, { name: entry.name });
        continue;
      }
      archive.append(entry.data ?? '', { name: entry.name });
    }

    archive.finalize().catch(reject);
  });
}
