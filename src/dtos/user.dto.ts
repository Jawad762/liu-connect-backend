export interface IUpdateProfileBody {
  name: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  major: string | null;
  school: string | null;
}

export interface IUserProfile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  school: string | null;
  major: string | null;
  followers_count: number;
  following_count: number;
  is_following?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserProfileSelf extends IUserProfile {
  email: string;
}

export interface IUserListItem {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

export interface IAddPushTokenBody {
  token: string;
}

export interface IDeleteMyAccountBody {
  password: string;
}