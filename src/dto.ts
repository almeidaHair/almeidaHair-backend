import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @IsString()
  password!: string;
}

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome completo.' })
  name!: string;

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha atual.' })
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  newPassword!: string;
}

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome completo.' })
  name!: string;

  @IsString()
  birthDate!: string;

  @IsString()
  phone!: string;

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @IsString()
  instagram!: string;

  @IsString()
  address!: string;

  @IsString()
  howFound!: string;

  @IsString()
  usualProcedures!: string;

  @IsString()
  preferences!: string;

  @IsString()
  notes!: string;

  @IsString()
  firstVisit!: string;

  @IsIn(['ativo', 'inativo'])
  status!: 'ativo' | 'inativo';

  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  password!: string;

  @IsBoolean()
  lgpdConsent!: boolean;
}

export class HistoryEntryDto {
  @IsBoolean()
  done!: boolean;

  @IsString()
  detail!: string;
}

export class HairDto {
  @IsArray()
  @IsString({ each: true })
  types!: string[];

  @IsArray()
  @IsString({ each: true })
  curvatures!: string[];

  @IsString()
  thickness!: string;

  @IsString()
  density!: string;

  @IsString()
  porosity!: string;

  @IsString()
  elasticity!: string;

  @IsString()
  elasticityNotes!: string;

  @IsArray()
  @IsString({ each: true })
  states!: string[];

  @IsString()
  stateOther!: string;
}

export class ScalpDto {
  @IsArray()
  @IsString({ each: true })
  types!: string[];

  @IsIn(['', 'Sim', 'Não'])
  flaking!: '' | 'Sim' | 'Não';

  @IsString()
  notes!: string;
}

export class HistoryDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => HistoryEntryDto)
  coloracao!: HistoryEntryDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => HistoryEntryDto)
  descoloracao!: HistoryEntryDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => HistoryEntryDto)
  progressiva!: HistoryEntryDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => HistoryEntryDto)
  relaxamento!: HistoryEntryDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => HistoryEntryDto)
  hena!: HistoryEntryDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => HistoryEntryDto)
  outros!: HistoryEntryDto;
}

export class ProfessionalDto {
  @IsString()
  goal!: string;

  @IsString()
  @IsNotEmpty({ message: 'Descreva o diagnóstico.' })
  diagnosis!: string;

  @IsString()
  recommendedProcedure!: string;

  @IsIn(['', 'Sim', 'Não'])
  strandTest!: '' | 'Sim' | 'Não';

  @IsString()
  strandResult!: string;

  @IsString()
  notes!: string;
}

export class CreateEvaluationDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe a data da avaliação.' })
  date!: string;

  @IsBoolean()
  sharedWithClient!: boolean;

  @IsDefined()
  @ValidateNested()
  @Type(() => HairDto)
  hair!: HairDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => ScalpDto)
  scalp!: ScalpDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => HistoryDto)
  history!: HistoryDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => ProfessionalDto)
  professional!: ProfessionalDto;
}
