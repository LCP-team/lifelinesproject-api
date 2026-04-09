import { Inject, Injectable } from '@nestjs/common';
import { Bucket } from '@google-cloud/storage';

export const PROFILE_PICTURES_PREFIX = 'public/profile-pictures';
export const VERIFICATION_PHOTOS_PREFIX = 'private/verification-photos';

@Injectable()
export class StorageService {
  constructor(
    @Inject('GCS_BUCKET') private readonly bucket: Bucket,
    @Inject('GCS_BASE_PATH') private readonly basePath: string,
  ) {}

  private prefix(path: string): string {
    return this.basePath ? `${this.basePath}/${path}` : path;
  }

  async upload(
    destination: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const prefixed = this.prefix(destination);
    const file = this.bucket.file(prefixed);
    await file.save(buffer, {
      metadata: { contentType },
      resumable: false,
    });
    return prefixed;
  }

  async deleteFile(filePath: string): Promise<void> {
    if (filePath) {
      const prefixed = this.prefix(filePath);
      const file = this.bucket.file(prefixed);
      const [exists] = await file.exists();
      if (exists) await file.delete();
    }
  }

  getPublicUrl(filePath: string): string {
    return `https://storage.googleapis.com/${this.bucket.name}/${this.prefix(filePath)}`;
  }

  async getSignedUrl(filePath: string): Promise<string> {
    const file = this.bucket.file(this.prefix(filePath));
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });
    return url;
  }

  async download(filePath: string): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string;
  }> {
    const file = this.bucket.file(this.prefix(filePath));
    const [metadata] = await file.getMetadata();
    return {
      stream: file.createReadStream(),
      contentType: metadata.contentType ?? 'application/octet-stream',
    };
  }
}
