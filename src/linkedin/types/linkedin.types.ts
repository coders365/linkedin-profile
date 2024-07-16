import { ProxyDetails } from "src/modules/proxy/proxy.service";
// Common Types
export type LinkedinApiReqParams = {
  logContext: { text: `IntegrationId: ${string}`; integrationId: string };
  proxy: ProxyDetails;
  cookies: Record<string, any>[];
  userAgent?: string;
};

export type Pagination = {
  start: number;
  count: number;
  link: string[];
};

export type LegacyPagination = {
  createdBefore: number;
  createdAfter: number;
  count: number;
  start: number;
};

export enum LinkedinApiAction {
  PROFILE = "PROFILE",
  CONNECTION_LIST = "CONNECTION_LIST",
  INVITATION_LIST = "INVITATION_LIST",
  CONNECTION_LIST_CHANGES = "CONNECTION_LIST_CHANGES",
  CONVERSATION_LIST = "CONVERSATION_LIST",
  CONVERSATION = "CONVERSATION",
}

export type LinkedinError<R extends string = string> = {
  message: string;
  errorReason: string;
};

export type LinkedinAPIResponse<T extends Record<string, unknown> = {}, E extends string = string> =
  | ({
      success: "true";
    } & T)
  | ({
      success: "false";
    } & LinkedinError<E>);

export type LinkedinInvitationResponse = LinkedinAPIResponse<{}, "WEEKLY_LIMIT_REACHED" | "PERSONALIZED_MESSAGE_QUOTA_EXCEEDED">;

// Req Types
export type GetIntegrationStatusRequest = LinkedinApiReqParams;
export type IsProxyWorkingRequest = LinkedinApiReqParams;
export type GetProfileInformationRequest = LinkedinApiReqParams & { urn_id?: string };
export type GetFirstDegreeConnectionsRequest = LinkedinApiReqParams & Partial<Pagination>;
export type GetConversationListRequest = LinkedinApiReqParams & Partial<LegacyPagination>;
export type GetMessagesRequest = LinkedinApiReqParams & Partial<Pagination> & Partial<LegacyPagination> & { conversationUrn: string };
export type ManageReceivedInvitationRequest = LinkedinApiReqParams & { action: "accept" | "ignore"; sharedSecret: string; mailboxItemId: string };
export type WithdrawInvitationRequest = LinkedinApiReqParams & { mailboxItemId?: string; urn_id?: string };
export type SendMessageRequest = LinkedinApiReqParams & { message: string } & ({ conversationUrn: string } | { recipients: string[] });
export type SendInMailRequest = LinkedinApiReqParams & { recipients: string[]; subject: string; message: string; mailboxUrn: string; isPremium: boolean };
export type SendReactionToPostRequest = LinkedinApiReqParams & { urn_id: string; reaction?: Reaction };
export type EndorseSkillRequest = LinkedinApiReqParams & { urn_id: string };
export type InvitationRequest = LinkedinApiReqParams & { urn_id: string; message?: string };
export type SendTypingRequest = LinkedinApiReqParams & { profileUrn: string; conversationUrn: string };
export type GetSearchResultList = LinkedinApiReqParams & { start?: number; count?: number } & ({ searchUrl: string } | { query: string });
export type InvitationType = "SENT" | "PENDING";
export type GetInvitationsRequest = LinkedinApiReqParams & Partial<Pagination> & { invitationType: InvitationType };

// Res Types
export type GetInvitationsResponse = { invitations: Invitation[]; invitationType: InvitationType };
export type WithdrawInvitationResponse = { success: true; mailboxItemId: string; urn_id: string } | { success: false };

// TYPE

export type Connection = {
  urn_id: string;
  connectedAt: Date;
  publicIdentifier?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  profilePicUrl?: string | null;
};

export type Invitation = {
  urn_id: string;
  publicIdentifier: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  profilePicUrl?: string | null;
  sentOn: Date | null;
  receivedOn: Date | null;
  message?: string;
  sharedSecret: string;
  mailboxItemId: string;
};

export type Message = {
  sender: Sender;
  conversation_urn_id: string;
  quickReplies: string[] | null;

  createdAt: number;
  reactionSummaries: {
    // This is not an important feature for us right now!
    count: number;
    firstReactedAt: number;
    emoji: string;
    viewerReacted: boolean;
  }[];
  attachments:
    | {
        name: string;
        reference: {
          string: string;
        };
        mediaType: string;
        id: string;
        byteSize: number;
      }[]
    | null;
  postUrn: string | null;
  customContent: { mediaType: string; url: string };
  messageText: string;
};

export type Sender = {
  firstName: string;
  lastName: string;
  headline: string;
  publicIdentifier: string;
  urn_id: string;
  profilePicUrl: string;
};

export type Conversation = {
  conversationUrn: string;
  lastActivityAt: number;
  lastReadAt?: number;
  archived: boolean;
  starred: boolean; // skip
  blocked: boolean;
  read: boolean;
  groupChat: boolean;
  unreadCount: number;
  name?: string;
  messages: {
    sender: {
      firstName: string;
      lastName: string;
      headline: string;
      publicIdentifier: string;
      urn_id: string;
      profilePicUrl: string | null;
    };
    postUrn: string | null;
    entityUrn: string;
    createdAt: number;
    subject?: string;
    message: string;
    quickReplies: string[] | null;
  }[];
  msgParticipants: {
    firstName: string;
    lastName: string;
    occupation: string;
    urn_id: string;
    publicIdentifier: string;
    profilePicUrl: string | null;
  }[];
};

export type Profile = {
  firstName: string;
  lastName: string;
  headline: string;
  profilePicUrl: string | null;
  publicIdentifier: string;
  country?: string;
  urn_id: string;
  company: string;
  current_position: string;
  stillWorking: boolean | null;
  school: string | null;
  industries: null | string[];
} & ContactInfo;

export type ContactInfo = Partial<{
  email: string;
  phoneNumbers: { phoneNumber: string; type: string }[];
  websites: { category: string; url: string }[];
  birthDate: { day: number; month: number };
  address: string;
  instantMessengers: { provider: string; username: string }[];
}>;

export type Job = {
  companyUrn_id: string;
  industry: string;
  companyName: string;
  positionTitle: string;
  duration: Partial<{
    numYears: number;
    numMonths: number;
  }>;
};

export type SearchPeople = {
  fullName: string;
  headline?: string;
  firstName?: string;
  lastName?: string;
  connection: string;
  location: string;
  publicIdentifier?: string;
  urn_id: string;
  profilePic: {
    url: string;
    expiresAt: number;
  } | null;
  isPremium?: boolean;
  isOpenLink?: boolean;
  currentJob?: Partial<Job>;
  previousJobs?: Partial<Job>[];
};

export type SearchResult = {
  result: SearchPeople[];
  total: number;
  count: number;
  query: string;
};

export const REACTION = {
  LIKE: "LIKE",
  LOVE: "EMPATHY",
  HAHA: "ENTERTAINMENT",
  INSIGHTFUL: "INTEREST",
  SUPPORT: "APPRECIATION",
  CELEBRATE: "PRAISE",
} as const;
export type Reaction = keyof typeof REACTION;

export type InMailResponse = {
  conversationUrn: string;
};
