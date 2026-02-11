export type SecondMeApiErrorResponse = {
  code: number;
  message?: string;
  subCode?: string;
  detail?: string;
  [key: string]: unknown;
};

export type SecondMeApiOkResponse<TData> = {
  code: 0;
  message?: string;
  data: TData;
};

export type SecondMeApiResponse<TData> =
  | SecondMeApiOkResponse<TData>
  | SecondMeApiErrorResponse;

export type SecondMeOauthAuthorizeExternalRequest = {
  clientId: string;
  redirectUri: string;
  scope: string[];
  state?: string;
};

export type SecondMeOauthAuthorizeExternalData = {
  code: string;
  state?: string;
};

export type SecondMeOauthTokenData = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  scope?: string[];
};

export type SecondMeUserInfoData = {
  userId: string;
  name?: string;
  email?: string;
  avatar?: string;
  bio?: string;
  selfIntroduction?: string;
  profileCompleteness?: number;
  route?: string;
};

export type SecondMeUserShadesShade = {
  id: number;
  shadeName: string;
  shadeIcon?: string;
  confidenceLevel?: string;
  shadeDescription?: string;
  shadeDescriptionThirdView?: string;
  shadeContent?: string;
  shadeContentThirdView?: string;
  sourceTopics?: string[];
  shadeNamePublic?: string;
  shadeIconPublic?: string;
  confidenceLevelPublic?: string;
  shadeDescriptionPublic?: string;
  shadeDescriptionThirdViewPublic?: string;
  shadeContentPublic?: string;
  shadeContentThirdViewPublic?: string;
  sourceTopicsPublic?: string[];
  hasPublicContent?: boolean;
};

export type SecondMeUserShadesData = {
  shades: SecondMeUserShadesShade[];
};

export type SecondMeSoftMemoryItem = {
  id: number;
  factObject: string;
  factContent: string;
  createTime: number;
  updateTime: number;
};

export type SecondMeSoftMemoryData = {
  list: SecondMeSoftMemoryItem[];
  total: number;
};

export type SecondMeNoteAddRequest =
  | {
      memoryType?: 'TEXT';
      title?: string;
      content: string;
    }
  | {
      memoryType: 'LINK';
      title?: string;
      urls: string[];
    };

export type SecondMeNoteAddData = {
  noteId: number;
};

export type SecondMeTtsGenerateRequest = {
  text: string;
  emotion?:
    | 'happy'
    | 'sad'
    | 'angry'
    | 'fearful'
    | 'disgusted'
    | 'surprised'
    | 'calm'
    | 'fluent';
};

export type SecondMeTtsGenerateData = {
  url: string;
  durationMs?: number;
  sampleRate?: number;
  format?: string;
};

export type SecondMeChatStreamRequest = {
  message: string;
  sessionId?: string;
  appId?: string;
  systemPrompt?: string;
  receiverUserId?: number;
  enableWebSearch?: boolean;
};

export type SecondMeActStreamRequest = {
  message: string;
  actionControl: string;
  sessionId?: string;
  appId?: string;
  systemPrompt?: string;
  receiverUserId?: number;
};

export type SecondMeChatSessionSummary = {
  sessionId: string;
  appId?: string;
  lastMessage?: string;
  lastUpdateTime?: string;
  messageCount?: number;
};

export type SecondMeChatSessionListData = {
  sessions: SecondMeChatSessionSummary[];
};

export type SecondMeChatMessage = {
  messageId: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  senderUserId?: number;
  receiverUserId?: number | null;
  createTime?: string;
};

export type SecondMeChatSessionMessagesData = {
  sessionId: string;
  messages: SecondMeChatMessage[];
};

export type SecondMeSseCollectResult = {
  sessionId?: string;
  text: string;
};
