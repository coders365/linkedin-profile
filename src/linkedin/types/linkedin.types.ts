export interface LinkedinLoginRequest {
    integrationId: string;
    type: string;
    userAgent: string;
    extraHeaders: Record<string, string>;
    username: string;
    encryptedPassword: string;
    countryCode: string;
    countryName: string;
  }
  export type LinkedinLoginResponse = LinkedinServiceResponse & { isLoggedIn: boolean; requiredAction: string; message?: string };
  export type LinkedinVerifyResponse = LinkedinServiceResponse & { isLoggedIn: boolean; requiredAction?: string; message?: string };
  
  export interface LinkedinVerifyRequest {
    integrationId: string;
    username: string;
    code: string;
  }
  
  export interface LinkedinMessageRequest {
    integrationId: string;
    profileId: string;
    message?: string;
  }
  
  export interface LinkedinPostRequest {
    integrationId: string;
    text: string;
  }
  
  export interface LinkedinPostResponse {
    success: boolean;
    message: string;
  }
  
  export interface LinkedinViewProfileRequest {
    integrationId: string;
    profileId: string;
  }
  
  export interface LinkedinViewProfileResponse {
    success: boolean;
    message: string;
  }
  
  export interface LinkedinConnectionRequest {
    integrationId: string;
    profileId: string;
    message?: string;
  }
  export type LinkedinConnectionResponse = LinkedinServiceResponse;
  
  export interface LinkedinPostLikeRequest {
    integrationId: string;
    profileUrl: string;
  }
  
  export interface LinkedinPostLikeResponse {
    success: boolean;
    message: string;
  }
  
  export interface LinkedinProfileInfoRequest {
    integrationId: string;
    profileId: string;
  }
  
  export type LinkedinProfileInfoResponse = LinkedinServiceResponse<ProfileInformation>;
  type ProfileInformation = Partial<{
    firstName: string;
    lastName: string;
    profileUrl: string;
    propicUrl: string;
    profilePosition: string;
    companyName: string;
    contactEmail: string;
    numberOfConnection: string;
  }>;
  
  export type ErrorResponse = {
    success: false;
    message: string;
  } & {
    isConnected?: boolean;
    shouldRetry: boolean;
  };
  
  export type SuccessResponse<T> = T extends Record<string, never>
    ? {
        success: true;
      }
    : {
        success: true;
      } & T;
  
  export type LinkedinServiceResponse<T = Record<string, never>> = SuccessResponse<T> | ErrorResponse;
  
  export type LinkedinMessageResponse = LinkedinServiceResponse;
  
  export enum ConnectionType {
    CONNECTED = "CONNECTED",
    PENDING = "PENDING",
    AVAILABLE_TO_CONNECT = "AVAILABLE_TO_CONNECT",
  }
  
  export interface LinkedinConnectionStatusRequest {
    integrationId: string;
    profileId: string;
  }
  export type LinkedinConnectionStatusResponse = LinkedinServiceResponse<{
    type: ConnectionType;
  }>;
  
  export interface LinkedinFollowRequest {
    integrationId: string;
    profileId: string;
  }
  export type LinkedinFollowResponse = LinkedinServiceResponse<{
    message: string;
  }>;
  
  export interface LinkedinWithdrawInviteRequest {
    integrationId: string;
    profileId: string;
  }
  export type LinkedinWithdrawInviteResponse = LinkedinServiceResponse<{
    message: string;
  }>;
  
  export interface LinkedinEndorseSkillRequest {
    integrationId: string;
    profileId: string;
  }
  export type LinkedinEndorseSkillResponse = LinkedinServiceResponse<{
    message: string;
  }>;
  
  export interface LinkedinReplyMessageRequest {
    integrationId: string;
    profileId: string;
  }
  export type LinkedinReplyMessageResponse = LinkedinServiceResponse<{
    replyText: string;
  }>;
  