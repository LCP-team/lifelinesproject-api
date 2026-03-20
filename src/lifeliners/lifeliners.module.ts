import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { LifelinersController } from './lifeliners.controller';
import { LifelinersService } from './lifeliners.service';

@Module({
  imports: [StorageModule],
  controllers: [LifelinersController],
  providers: [LifelinersService],
  exports: [LifelinersService],
})
export class LifelinersModule {}
