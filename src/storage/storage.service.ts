import { Injectable, OnModuleInit } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';

export const PROFILE_PICTURES_DIR = join(
  process.cwd(),
  'uploads',
  'public',
  'profile-pictures',
);
export const VERIFICATION_PHOTOS_DIR = join(
  process.cwd(),
  'uploads',
  'private',
  'verification-photos',
);

@Injectable()
export class StorageService implements OnModuleInit {
  onModuleInit() {
    mkdirSync(PROFILE_PICTURES_DIR, { recursive: true });
    mkdirSync(VERIFICATION_PHOTOS_DIR, { recursive: true });
  }

  async deleteFile(filePath: string): Promise<void> {
    if (filePath && existsSync(filePath)) {
      await unlink(filePath);
    }
  }
}
