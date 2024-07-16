import { Connection, Conversation, Invitation, Message } from "../api/linkedin/types.linkedin.api";

export enum IntegrationType {
  LINKEDIN = "LINKEDIN",
  GMAIL = "GMAIL",
  /* more to be added in future */
}
// REQUESTS
export type Request = { integrationId: string; count: "ALL" | number; start?: number };

export type FetchConnectionListRequest = Request;

export type FetchProfileInformation = {
  integrationId: string;
  urn_id?: string;
};

export type FetchConversationListRequest = { integrationId: string; createdAfter: number | null; createdBefore?: number | null };

export type FetchMessagesRequest = { integrationId: string; conversationUrn: string; start?: number; createdAfter?: number; createdBefore?: number };
export type FetchSearchResult = Omit<Request, "count"> & { count?: number; searchUrl: string; query?: string };
export type SendMessageRequest = {
  integrationId: string;
  message: string;
} & (
  | { conversationUrn: string }
  | {
      recipientUrn: string;
    }
);

export type FetchInvitationListRequest = Request & {
  invitationType: "PENDING" | "SENT";
  refreshDb: boolean;
};

export type ReceivedInvitationActionRequest = {
  integrationId: string;
  invitationId: string;
  mailboxItemId: string;
  sharedSecret: string;
  action: "accept" | "ignore";
};

export type WithdrawInvitationActionRequest = {
  integrationId: string;
  invitationId: string;
  action: "withdraw";
} & (
  | {
      mailboxItemId: string;
    }
  | {
      urn_id: string;
      mailboxItemId?: string;
    }
);

export type CheckSearchUrlRequest = {
  integrationId: string;
  searchUrl: string;
};

export type SendReactRequest = {
  integrationId: string;
  urn_id: string;
};

export type SkillEndorsementRequest = {
  integrationId: string;
  urn_id: string;
};

export type FollowRequest = {
  integrationId: string;
  urn_id: string;
};

export type InvitationRequest = {
  integrationId: string;
  urn_id: string;
  message?: string;
};

export type InMailRequest = {
  integrationId: string;
  targetUrn: string;
  mailboxUrn: string;
  isPremium: boolean;
  message: string;
  subject: string;
};

// RESOPONSES
export type Response = { integrationId: string };
export type FetchConnectionsListFinished = Response & {
  connections: Connection[];
  fetchCompleted: boolean;
  start: number | null;
};
export type FetchInvitationsListFinished = Response & {
  invitations: Invitation[];
  invitationType: "SENT" | "RECEIVED";
  fetchCompleted: boolean;
  start: number | null;
  refreshDb: boolean;
};
export type FetchConversationListFinished = Response & {
  fetchCompleted: boolean;
  conversations: Conversation[];
  createdBefore: number | null;
  createdAfter: number | null;
};

export type WithdrawInvitationFinished = Response & {
  invitationId: string;
  mailboxItemId: string;
  urn_id: string;
  success: boolean;
};
export type FetchMessageFinished = Response & {
  conversationUrn: string;
  fetchCompleted: boolean;
  messages: Message[];
  hasFirstMessage?: boolean;
};

export type LinkedinConnectionStatusChaned = Response & {
  status: string;
  message: string;
  engineCode?: string;
  data?: any;
};

export type CheckSearchUrlResponse = Response & {
  isValid: boolean;
  total: number;
  needPremium: boolean;
};
