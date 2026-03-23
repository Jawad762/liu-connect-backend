import type { IUserProfile, IUserProfileSelf, IUserListItem } from "../dtos/user.dto.ts";

export function toProfileSelf(user: {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
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
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    cover_url: user.cover_url,
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
    id: string;
    name: string | null;
    avatar_url: string | null;
    cover_url: string | null;
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
  id: string;
  name: string | null;
  avatar_url: string | null;
}): IUserListItem {
  return {
    id: user.id,
    name: user.name,
    avatar_url: user.avatar_url,
  };
}
