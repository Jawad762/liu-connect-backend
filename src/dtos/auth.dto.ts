export interface ISignUpBody {
  email: string;
  password: string;
}

export interface ISignInBody {
  email: string;
  password: string;
}

export interface IAuthUser {
  id: number;
  publicId: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  school: string | null;
  major: string | null;
  followers_count: number;
  following_count: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISignInData {
  user: IAuthUser;
  accessToken: string;
}

export interface IRefreshData {
  accessToken: string;
}

export interface IVerifyEmailBody {
  email: string;
  code: string;
}

export interface IResendVerificationBody {
  email: string;
}

export interface IForgotPasswordBody {
  email: string;
}

export interface IResetPasswordBody {
  email: string;
  code: string;
  newPassword: string;
}

export interface IChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export interface ISignOutBody {
  refreshToken: string;
}

export interface IRefreshTokenBody extends ISignOutBody {}