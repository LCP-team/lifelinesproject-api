import { PartialType } from '@nestjs/mapped-types';
import { CreateLifelinerDto } from './create-lifeliner.dto';

export class UpdateLifelinerDto extends PartialType(CreateLifelinerDto) {}
