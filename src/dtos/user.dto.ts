export interface IUpdateProfileBody {
  name: string;
  avatar_url: string | null;
  bio: string | null;
}

export interface IUserProfile {
  publicId: string;
  name: string | null;
  avatar_url: string | null;
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
  id: number;
  email: string;
}

export interface IUserListItem {
  publicId: string;
  name: string | null;
  avatar_url: string | null;
}

export interface IAddPushTokenBody {
  token: string;
}
