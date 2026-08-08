import { IsEmail, IsString, Length } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}
