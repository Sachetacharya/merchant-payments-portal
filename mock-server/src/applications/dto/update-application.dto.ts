import { IsEmail, IsIn, IsNumber, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import type { BusinessType } from '../application.model.js';

const BUSINESS_TYPES: BusinessType[] = ['LLC', 'CORPORATION', 'SOLE_PROPRIETOR', 'PARTNERSHIP'];

export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  legalBusinessName?: string;

  @IsOptional()
  @IsIn(BUSINESS_TYPES)
  businessType?: BusinessType;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  ownerFullName?: string;

  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  ownerNid?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankBranch?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedMonthlyVolume?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  averageTransactionSize?: number;
}
