import { Injectable, NotFoundException } from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DOCUMENT_FILE_KINDS,
  PHOTO_FILE_KINDS,
  PROFILE_MIME_BY_KIND,
} from './file-signature';
import { ProfileFileStorageService } from './profile-file-storage.service';
import { validateProfileFile } from './profile-file-validator';

export type DocumentOwnerTable = 'education' | 'certification';

export interface StoredFileContent {
  buffer: Buffer;
  mimeType: string;
  name?: string;
}

interface DocumentFields {
  documentPath: string | null;
  documentMimeType: string | null;
  documentName: string | null;
}

const MAX_DOCUMENT_NAME_LENGTH = 120;

const documentSelect = {
  documentPath: true,
  documentMimeType: true,
  documentName: true,
} as const;

@Injectable()
export class ProfileFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ProfileFileStorageService,
  ) {}

  async setPhoto(
    userId: string,
    content: Buffer,
  ): Promise<{ photoMimeType: string }> {
    const kind = await validateProfileFile(content, PHOTO_FILE_KINDS);
    const profile = await this.prisma.profile.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true, photoPath: true },
    });
    const photoPath = await this.storage.save(content, kind);
    const photoMimeType = PROFILE_MIME_BY_KIND[kind];
    await this.prisma.profile.update({
      where: { id: profile.id },
      data: { photoPath, photoMimeType },
    });
    await this.storage.remove(profile.photoPath);
    return { photoMimeType };
  }

  async getPhoto(userId: string): Promise<StoredFileContent> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { photoPath: true, photoMimeType: true },
    });
    if (!profile?.photoPath || !profile.photoMimeType) {
      throw new NotFoundException('No hay foto de perfil.');
    }
    const buffer = await this.storage.readOrNull(profile.photoPath);
    if (!buffer) {
      throw new NotFoundException('La foto de perfil ya no está disponible.');
    }
    return { buffer, mimeType: profile.photoMimeType };
  }

  async deletePhoto(userId: string): Promise<void> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true, photoPath: true },
    });
    if (!profile?.photoPath) {
      return;
    }
    await this.prisma.profile.update({
      where: { id: profile.id },
      data: { photoPath: null, photoMimeType: null },
    });
    await this.storage.remove(profile.photoPath);
  }

  async setDocument(
    userId: string,
    table: DocumentOwnerTable,
    itemId: string,
    content: Buffer,
    originalName: string,
  ): Promise<{ documentName: string; documentMimeType: string }> {
    const kind = await validateProfileFile(content, DOCUMENT_FILE_KINDS);
    const current = await this.findOwnedItem(userId, table, itemId);
    const documentName = path
      .basename(originalName)
      .slice(0, MAX_DOCUMENT_NAME_LENGTH);
    const documentPath = await this.storage.save(content, kind);
    const documentMimeType = PROFILE_MIME_BY_KIND[kind];
    await this.updateItemDocument(table, itemId, {
      documentPath,
      documentMimeType,
      documentName,
    });
    await this.storage.remove(current.documentPath);
    return { documentName, documentMimeType };
  }

  async getDocument(
    userId: string,
    table: DocumentOwnerTable,
    itemId: string,
  ): Promise<StoredFileContent> {
    const item = await this.findOwnedItem(userId, table, itemId);
    if (!item.documentPath || !item.documentMimeType) {
      throw new NotFoundException('El elemento no tiene documento adjunto.');
    }
    const buffer = await this.storage.readOrNull(item.documentPath);
    if (!buffer) {
      throw new NotFoundException(
        'El documento adjunto ya no está disponible.',
      );
    }
    return {
      buffer,
      mimeType: item.documentMimeType,
      name: item.documentName ?? undefined,
    };
  }

  async deleteDocument(
    userId: string,
    table: DocumentOwnerTable,
    itemId: string,
  ): Promise<void> {
    const item = await this.findOwnedItem(userId, table, itemId);
    if (!item.documentPath) {
      return;
    }
    await this.updateItemDocument(table, itemId, {
      documentPath: null,
      documentMimeType: null,
      documentName: null,
    });
    await this.storage.remove(item.documentPath);
  }

  private async findOwnedItem(
    userId: string,
    table: DocumentOwnerTable,
    itemId: string,
  ): Promise<DocumentFields> {
    const where = { id: itemId, profile: { userId } };
    const item =
      table === 'education'
        ? await this.prisma.education.findFirst({
            where,
            select: documentSelect,
          })
        : await this.prisma.certification.findFirst({
            where,
            select: documentSelect,
          });
    if (!item) {
      throw new NotFoundException('Elemento no encontrado.');
    }
    return item;
  }

  private async updateItemDocument(
    table: DocumentOwnerTable,
    itemId: string,
    data: DocumentFields,
  ): Promise<void> {
    if (table === 'education') {
      await this.prisma.education.update({ where: { id: itemId }, data });
      return;
    }
    await this.prisma.certification.update({ where: { id: itemId }, data });
  }
}
