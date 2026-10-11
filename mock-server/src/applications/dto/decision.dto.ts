import { IsBoolean, IsString, MinLength } from 'class-validator';

export class DecisionDto {
  @IsBoolean()
  approved!: boolean;

  @IsString()
  @MinLength(1)
  notes!: string;
}
