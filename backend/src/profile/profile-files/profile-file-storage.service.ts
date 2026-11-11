import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import * as path from 'path';
import type { ProfileFileKind } from './file-signature';

export const PROFILE_UPLOAD_DIR = path.join('uploads', 'profile');

@Injectable()
export class ProfileFileStorageService {
  private readonly rootDir = path.resolve(process.cwd(), PROFILE_UPLOAD_DIR);

  async save(buffer: Buffer, kind: ProfileFileKind): Promise<string> {
    await mkdir(this.rootDir, { recursive: true });
    const relativePath = path.join(
      PROFILE_UPLOAD_DIR,
      `${randomUUID()}.${kind}`,
    );
    await writeFile(this.resolveSafePath(relativePath), buffer);
    return relativePath;
  }

  read(relativePath: string): Promise<Buffer> {
    return readFile(this.resolveSafePath(relativePath));
  }

  // Un archivo borrado del disco no debe romper una descarga: se trata como
  // ausente. Otros errores (permisos, ruta inválida) sí se propagan.
  async readOrNull(relativePath: string): Promise<Buffer | null> {
    try {
      return await this.read(relativePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async remove(relativePath: string | null | undefined): Promise<void> {
    if (!relativePath) {
      return;
    }
    try {
      await unlink(this.resolveSafePath(relativePath));
    } catch {
      // El archivo ya no existe; no es un error para el usuario.
    }
  }

  private resolveSafePath(relativePath: string): string {
    const absolutePath = path.resolve(process.cwd(), relativePath);
    if (!absolutePath.startsWith(this.rootDir + path.sep)) {
      throw new Error('Ruta de archivo fuera del directorio permitido.');
    }
    return absolutePath;
  }
}
