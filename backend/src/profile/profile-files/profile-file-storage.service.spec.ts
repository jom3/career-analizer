import { ProfileFileStorageService } from './profile-file-storage.service';

describe('ProfileFileStorageService', () => {
  const storage = new ProfileFileStorageService();

  it('returns null when the file no longer exists on disk', async () => {
    await expect(
      storage.readOrNull('uploads/profile/missing-file.pdf'),
    ).resolves.toBeNull();
  });

  it('rejects paths outside the upload directory', async () => {
    await expect(storage.readOrNull('../../etc/passwd')).rejects.toThrow(
      'Ruta de archivo fuera del directorio permitido.',
    );
  });
});
