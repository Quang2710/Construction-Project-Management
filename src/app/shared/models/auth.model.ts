import { User } from './user.model';

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface LoginResponse {
  readonly accessToken: string;
  /** Thời gian sống của token, tính bằng giây. */
  readonly expiresIn: number;
  readonly user: User;
}
