import type { IUserProfile, IUserProfileSelf, IUserListItem } from "../dtos/users.dto.ts";

export function toProfileSelf(user: {
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
}): IUserProfileSelf {
  return {
    id: user.id,
    publicId: user.publicId,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    bio: user.bio,
    school: user.school,
    major: user.major,
    followers_count: user.followers_count,
    following_count: user.following_count,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toProfile(
  user: {
    publicId: string;
    name: string | null;
    avatar_url: string | null;
    bio: string | null;
    school: string | null;
    major: string | null;
    followers_count: number;
    following_count: number;
    createdAt: Date;
    updatedAt: Date;
  },
  isFollowing: boolean
): IUserProfile {
  return {
    ...user,
    is_following: isFollowing,
  };
}

export function toUserListItem(user: {
  publicId: string;
  name: string | null;
  avatar_url: string | null;
}): IUserListItem {
  return {
    publicId: user.publicId,
    name: user.name,
    avatar_url: user.avatar_url,
  };
}
