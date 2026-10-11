import { IsString } from 'class-validator';

export class AssignDto {
  @IsString()
  reviewerId!: string;
}
