export interface ICreateCommunityBody {
  name: string;
  description?: string | null;
  avatar_url?: string | null;
}

export interface IUpdateCommunityBody {
  name?: string;
  description?: string | null;
  avatar_url?: string | null;
}

