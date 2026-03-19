import { Module } from '@nestjs/common';
import { LifelinersController } from './lifeliners.controller';
import { LifelinersService } from './lifeliners.service';

@Module({
  controllers: [LifelinersController],
  providers: [LifelinersService],
})
export class LifelinersModule {}
