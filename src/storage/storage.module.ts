import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'GCS_BUCKET',
      useFactory: (configService: ConfigService) => {
        const credentials = configService.get<string>('GCS_CREDENTIALS');
        const keyFilename = configService.get<string>('GCS_KEYFILE_PATH');
        const storage = new Storage({
          ...(credentials
            ? {
                credentials: JSON.parse(credentials) as {
                  client_email: string;
                  private_key: string;
                },
              }
            : { keyFilename }),
          projectId: configService.get<string>('GCS_PROJECT_ID'),
        });
        return storage.bucket(configService.get<string>('GCS_BUCKET_NAME')!);
      },
      inject: [ConfigService],
    },
    {
      provide: 'GCS_BASE_PATH',
      useFactory: (configService: ConfigService) =>
        configService.get<string>('GCS_BASE_PATH')?.replace(/\/+$/, '') ?? '',
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
