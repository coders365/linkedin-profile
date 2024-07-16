import { Injectable, Logger } from "@nestjs/common";
import {
  Connection,
  Conversation,
  GetConversationListRequest,
  GetFirstDegreeConnectionsRequest,
  GetInvitationsRequest,
  GetProfileInformationRequest,
  GetMessagesRequest,
  Invitation,
  LinkedinApiReqParams,
  ManageReceivedInvitationRequest,
  Message,
  Profile,
  WithdrawInvitationRequest,
  SearchPeople,
  InMailResponse,
} from "./types/linkedin.types";
// import { IntegrationSessionService, LinkedinSession } from "../session/integration.session.service";
// import { LinkedinApiService } from "../api/linkedin/linkedin.api.service";
import {
  FetchConnectionListRequest,
  FetchInvitationListRequest,
  FetchConversationListRequest,
  ReceivedInvitationActionRequest,
  WithdrawInvitationActionRequest,
  FetchMessagesRequest,
  FetchProfileInformation,
  SendMessageRequest,
  FetchSearchResult,
  CheckSearchUrlResponse,
  CheckSearchUrlRequest,
  SendReactRequest,
  FollowRequest,
  SkillEndorsementRequest,
  InvitationRequest,
  InMailRequest,
} from "./types/manager.types";
// import { EngineManagerAutoPublisher } from "./manager.pub";
// import { ActionData, ActionReqInfo, ActionType, EngineRequest, EngineResponse, ErrorResponse } from "src/modules/pubsub/engine/engine.types";
import { LinkedinServiceResponse } from "./types/linkedin.t";
//import { LinkedinService } from "../linkedin/service";
//import { randomBetween } from "src/modules/util/helper";

@Injectable()
export class LinkedinService  {
  private logger: Logger = new Logger(LinkedinService.name);
  constructor(
    //private proxyService: ProxyService,
    private linkedinSession: IntegrationSessionService,
    private linkedinApiService: LinkedinApiService,
    //private publisher: EngineManagerAutoPublisher,
    private linkedinAutomation: LinkedinService,
  ) {
    //super();
  }
  private maxConnectionBatchCount = 100;
  private maxInvitationBatchCount = 100;
  private maxMessageBatchCount = 20;
  private batchSize = 25;
  // private maxSearchResultBatchCount = 50;

  private API_CALL_ACTIONS = [
    ActionType.PROFILE_FETCH,
    ActionType.SEND_MESSAGE,
    ActionType.LIKE_POST,
    ActionType.ENDORSE_SKILL,
    ActionType.FOLLOW_REQUEST,
    ActionType.SEND_INVITE,
    ActionType.WITHDRAW_INVITE,
    ActionType.SEND_INEMAIL,
  ];

  public async getApiParams(integrationId: string): Promise<LinkedinApiReqParams> {
    //const proxy = await this.proxyService.getRecommendedProxyDetails(integrationId);
    const session = (await this.linkedinSession.getSession(integrationId)) as LinkedinSession;
    const cookies = session?.context.cookies;
    return {  cookies, userAgent: session.userAgent, logContext: { text: `IntegrationId: ${integrationId}`, integrationId } };
  }

  public async isApiParamsAvailable(integrationId: string, avoidAuthProxy: boolean): Promise<Response<{}, "PROXY_ISSUE">> {
    let proxy;
    try {
      proxy = await this.proxyService.allocateProxy(integrationId, avoidAuthProxy);
      if (!proxy) {
        this.logger.error(`Manager Service - isApiParamsAvailability - couldn't create proxy - IntegrationId: ${integrationId} - Proxy Issue - Couldn't generate proxy`);
        return { success: false, reason: "PROXY_ISSUE", message: "Couldn't generate proxy." };
      }
    } catch (error) {
      this.logger.error(`Manager Service - isApiParamsAvailability - IntegrationId: ${integrationId} - Proxy Issue - Couldn't generate proxy -  ${error.message}`);
      return { success: false, reason: "PROXY_ISSUE", message: `Please try with different country near to you.` };
    }
    return { success: true };
  }

  async processProfileInformation({ integrationId, urn_id, params: defaultParams }: FetchProfileInformation & { params?: LinkedinApiReqParams }): Promise<{
    integrationId: string;
    profile: Profile | null;
  }> {
    try {
      const params = defaultParams ?? (await this.getApiParams(integrationId));
      const request: GetProfileInformationRequest = {
        ...params,
        urn_id,
      };
      const profile: Profile | null = await this.linkedinApiService.getProfile(request);
      return { profile, integrationId };
    } catch (error) {
      this.logger.error(`Manager Service - processProfileInformation -  IntegrationId: ${integrationId} Error - ${error}`);
      return { integrationId, profile: null };
    }
  }

  async processFetchConnectionList({ integrationId, count, start = 0 }: FetchConnectionListRequest): Promise<{
    integrationId: string;
    connections: Connection[];
  }> {
    this.logger.debug(`processFetchConnectionList ${integrationId}`);
    let connections: Connection[] = [];
    let fetchDataAtOnce = this.maxConnectionBatchCount;

    const params = await this.getApiParams(integrationId);

    const fetchConnections = async () => {
      if (count !== "ALL") {
        fetchDataAtOnce = Math.min(this.maxConnectionBatchCount, count - connections.length);
      }

      const request: GetFirstDegreeConnectionsRequest = {
        ...params,
        start,
        count: fetchDataAtOnce,
      };

      const response = await this.linkedinApiService.getFirstDegreeConnections(request);
      if (response.success === false) {
        this.logger.error(`Connection integrationId: ${integrationId} - Got error ${response.message} - Ending fetching`);
        await this.publisher.notifyLinkedinConnectionListFetchFinished({
          integrationId,
          connections: [],
          fetchCompleted: true,
          start: null,
        });
        return;
      }

      connections = connections.concat(response.connections);
      const totalConnections = response.connections.length;
      this.logger.log(`🚀 Connection integrationId: ${integrationId} - Connection count ${totalConnections}`);

      if (totalConnections === 0) {
        this.logger.log(`Connection integrationId: ${integrationId} - total Connections: 0 - Connection List Fetch Completed 🚀`);
        await this.publisher.notifyLinkedinConnectionListFetchFinished({
          integrationId,
          connections: [],
          fetchCompleted: true,
          start: null,
        });
        return;
      }
      if (fetchDataAtOnce < this.maxConnectionBatchCount || totalConnections === 0 || totalConnections < fetchDataAtOnce || connections.length === count) {
        for (let i = 0; i < totalConnections; i += this.batchSize) {
          const batch = response.connections.slice(i, i + this.batchSize);
          const isLastBatch = i + this.batchSize >= totalConnections;

          await this.publisher.notifyLinkedinConnectionListFetchFinished({
            integrationId,
            connections: batch,
            fetchCompleted: isLastBatch ? true : false,
            start: null,
          });
        }
        this.logger.log(`Connection integrationId: ${integrationId} - Connection List Fetch Completed 🚀`);
      } else {
        for (let i = 0; i < totalConnections; i += this.batchSize) {
          const batch = response.connections.slice(i, i + this.batchSize);
          const isLastBatch = i + this.batchSize >= totalConnections;

          await this.publisher.notifyLinkedinConnectionListFetchFinished({
            integrationId,
            connections: batch,
            fetchCompleted: false,
            start: isLastBatch ? start + fetchDataAtOnce : null,
          });
        }

        // start += fetchDataAtOnce;
        // const recursionTime = randomBetween(7000, 10000);
        // this.logger.log(`🚀 ~ ManagerService ~ fetchConnections ~ recursionTime: ${recursionTime}`);
        // setTimeout(fetchConnections, recursionTime);
      }
    };

    await fetchConnections();
    return { integrationId, connections };
  }

  async processFetchInvitationList({ integrationId, count, start = 0, invitationType, refreshDb = false }: FetchInvitationListRequest): Promise<{
    integrationId: string;
    invitations: Invitation[];
    invitationType: "RECEIVED" | "SENT";
  }> {
    const convertedInvitationType = invitationType === "PENDING" ? "RECEIVED" : "SENT";
    let invitations: Invitation[] = [];
    let fetchDataAtOnce = this.maxInvitationBatchCount;
    const params = await this.getApiParams(integrationId);

    const fetchInvitations = async () => {
      if (count !== "ALL") {
        fetchDataAtOnce = Math.min(this.maxInvitationBatchCount, count - invitations.length);
      }

      const request: GetInvitationsRequest = {
        ...params,
        start,
        count: fetchDataAtOnce,
        invitationType,
      };

      const response = await this.linkedinApiService.getInvitations(request);

      if (response.success === false) {
        this.logger.error(`Invitation integrationId: ${integrationId} - Type:${convertedInvitationType} - Got error ${response.message} - Ending fetching`);
        await this.publisher.notifyLinkedinInvitationListFetchFinished({
          integrationId,
          invitations: [],
          invitationType: convertedInvitationType,
          fetchCompleted: true,
          start: null,
          refreshDb: false,
        });
        return;
      }

      invitations = invitations.concat(response.invitations);
      const totalInvitations = response.invitations.length;
      this.logger.log(`🚀 Invitation ~ integrationId: ${integrationId} - Type:${convertedInvitationType} - Invitation count ${totalInvitations}`);

      if (totalInvitations === 0) {
        this.logger.log(` Invitation ~ integrationId: ${integrationId} - Type:${convertedInvitationType} - total Invitations: 0 - Invitation List Fetch Completed 🚀`);
        await this.publisher.notifyLinkedinInvitationListFetchFinished({
          integrationId,
          invitations: [],
          invitationType: convertedInvitationType,
          fetchCompleted: true,
          start: null,
          refreshDb,
        });
        return;
      }

      if (fetchDataAtOnce < this.maxInvitationBatchCount || totalInvitations === 0 || totalInvitations < fetchDataAtOnce || invitations.length === count) {
        for (let i = 0; i < totalInvitations; i += this.batchSize) {
          const batch = response.invitations.slice(i, i + this.batchSize);
          const isLastBatch = i + this.batchSize >= totalInvitations;

          await this.publisher.notifyLinkedinInvitationListFetchFinished({
            integrationId,
            invitations: batch,
            invitationType: convertedInvitationType,
            fetchCompleted: isLastBatch ? true : false,
            start: null,
            refreshDb,
          });
        }
        this.logger.log(
          `Linkedin Manager Invitations integrationId: ${integrationId} - Type:${convertedInvitationType} - InvitationType: ${invitationType} - Invitation List Fetch Completed 🚀`,
        );
      } else {
        for (let i = 0; i < totalInvitations; i += this.batchSize) {
          const batch = response.invitations.slice(i, i + this.batchSize);
          const isLastBatch = i + this.batchSize >= totalInvitations;

          await this.publisher.notifyLinkedinInvitationListFetchFinished({
            integrationId,
            invitations: batch,
            invitationType: convertedInvitationType,
            fetchCompleted: false,
            start: isLastBatch ? start + fetchDataAtOnce : null,
            refreshDb,
          });
        }

        // start += fetchDataAtOnce;
        // const recursionTime = randomBetween(4000, 8000);
        // this.logger.log(`🚀 ~ ManagerService ~ fetchInvitations ~ recursionTime: ${recursionTime}`);
        // setTimeout(fetchInvitations, recursionTime);
      }
    };

    await fetchInvitations();
    return { integrationId, invitations, invitationType: convertedInvitationType };
  }

  async processManageReceivedInvitation({ integrationId, invitationId, mailboxItemId, sharedSecret, action }: ReceivedInvitationActionRequest): Promise<boolean> {
    this.logger.log(`Invitation id: ${invitationId} - action: ${action}`);
    try {
      const params = await this.getApiParams(integrationId);
      const request: ManageReceivedInvitationRequest = {
        ...params,
        mailboxItemId: `urn:li:fsd_invitation:${mailboxItemId}`,
        sharedSecret,
        action,
      };
      const response = await this.linkedinApiService.manageReceivedInvitation(request);
      return !!response;
    } catch (error) {
      this.logger.error(`Manager Service - processManageReceivedInvitation Error - ${error}`);
      return false;
    }
  }

  async processWithdrawInvitation({ integrationId, invitationId, mailboxItemId, ...rest }: WithdrawInvitationActionRequest): Promise<{ integrationId: string; success: boolean }> {
    this.logger.log(`Invitation id: ${invitationId} - action: Withdraw`);
    try {
      const params = await this.getApiParams(integrationId);
      const request: WithdrawInvitationRequest = {
        ...params,
        mailboxItemId: mailboxItemId ? `urn:li:fsd_invitation:${mailboxItemId}` : null,
        urn_id: "urn_id" in rest ? rest.urn_id : null,
      };
      const response = await this.linkedinApiService.withdrawInvitation(request);
      this.logger.log(`🚀 ~ ManagerService ~ processWithdrawInvitation ~ response: ${JSON.stringify(response)}`);

      if (response.success || (!response.success && !!invitationId && invitationId != "Campaign Action: No Invitation Id")) {
        await this.publisher.notifyLinkedinWithdrawInvitationFinished({
          integrationId,
          invitationId,
          mailboxItemId: response.success ? response.mailboxItemId : "",
          urn_id: response.success ? response.urn_id : "",
          success: !!response,
        });
      }
      return { integrationId, success: response.success };
    } catch (error) {
      this.logger.error(`Manager Service - processWithdrawInvitation Error - ${error}`);
      return { integrationId, success: false };
    }
  }

  async getConversationList({ integrationId }: FetchConversationListRequest): Promise<{
    integrationId: string;
    conversations: Conversation[];
    total: number;
  }> {
    let conversations: Conversation[] = [];
    const params = await this.getApiParams(integrationId);

    conversations = await this.linkedinApiService.getConversationList({
      ...params,
      count: this.maxMessageBatchCount,
    });
    this.logger.log(`Linkedin Manager - integrationId: ${integrationId} -  fetch Conversation through API controller  - count ${conversations.length}`);
    return { integrationId, conversations, total: conversations.length };
  }

  // Todo: Implement filter for count if needed! Currently we are not using it.
  async processFetchConversationList({ integrationId, createdAfter, createdBefore = null }: FetchConversationListRequest): Promise<{
    integrationId: string;
    conversations: Conversation[];
    total: number;
  }> {
    const conversations: Conversation[] = [];
    const params = await this.getApiParams(integrationId);
    let response: Conversation[] = [];

    const request: GetConversationListRequest = {
      ...params,
      count: this.maxMessageBatchCount,
    };

    // This will fetch asynchronously all the messages after the given time(createdAfter).
    const fetchConversation = async (createdBefore: number = null) => {
      if (createdBefore) {
        if (createdBefore <= createdAfter) {
          this.logger.log(
            `Linkedin Manager Conversation List integrationId: ${integrationId} - fetchConversation - No further changed conversation - conversation fetching ended 🚀`,
          );
          await this.publisher.notifyLinkedinConversationListFetchFinished({ integrationId, conversations: [], fetchCompleted: true, createdBefore: null, createdAfter });
          return;
        }
        request.createdBefore = createdBefore;
      }
      this.logger.warn(`Linkedin Manager Conversation List integrationId: ${integrationId} -  fetchConversation - GOING TO FETCH FROM LINKEDIN`);
      response = await this.linkedinApiService.getConversationList(request);
      this.logger.log(`Linkedin Manager Conversation List integrationId: ${integrationId} -  fetchConversation - count ${response.length} - createdBefore ${createdBefore} 🚀 `);
      if (response.length < this.maxMessageBatchCount) {
        this.logger.log(`Linkedin Manager Conversation List integrationId: ${integrationId} -  fetchConversation - conversation list ended 🚀`);
        await this.publisher.notifyLinkedinConversationListFetchFinished({ integrationId, conversations: response, fetchCompleted: true, createdBefore: null, createdAfter });
        return;
      } else if (response.length == this.maxMessageBatchCount) {
        createdBefore = response[response.length - 1].messages[0].createdAt;
        await this.publisher.notifyLinkedinConversationListFetchFinished({ integrationId, conversations: response, fetchCompleted: false, createdBefore, createdAfter });
        this.logger.log(
          `Linkedin Manager - integrationId: ${integrationId} -  fetchConversation - fetchCompleted: false - createdBefore: ${createdBefore} - createdAfter: ${createdAfter}`,
        );
      }
      // const timeout = randomBetween(3000, 10000);
      // this.logger.log(`Linkedin Manager Conversation List integrationId: ${integrationId} - recurring fetchConversation - timeout: ${timeout}`);
      // setTimeout(() => {
      //   fetchConversation(createdBefore, emergencyCount - 1);
      // }, timeout);
    };

    await fetchConversation(createdBefore);
    return { integrationId, conversations, total: conversations.length };
  }

  async processFetchMessages({ integrationId, conversationUrn, start, createdBefore }: FetchMessagesRequest): Promise<{
    integrationId: string;
    messages: Message[];
  }> {
    let messages: Message[] = [];
    const count = this.maxMessageBatchCount;
    const params = await this.getApiParams(integrationId);
    this.logger.debug(`processFetchMessages ${integrationId} - ${conversationUrn} - ${start} - ${createdBefore}`);
    const request: GetMessagesRequest = {
      ...params,
      start,
      count,
      conversationUrn,
      createdBefore,
    };
    messages = await this.linkedinApiService.getMessages(request);
    return { integrationId, messages: messages };
  }
  async processSendMessage({ integrationId, message, ...req }: SendMessageRequest): Promise<boolean> {
    const params = await this.getApiParams(integrationId);
    if ("conversationUrn" in req) {
      return !!(await this.linkedinApiService.sendMessage({ ...params, message, conversationUrn: req.conversationUrn }));
    } else {
      return !!(await this.linkedinApiService.sendMessage({ ...params, message, recipients: [req.recipientUrn] }));
    }
  }

  async processSendTyping({ integrationId, conversationUrn, profileUrn }: { integrationId: string; profileUrn; conversationUrn: string }): Promise<boolean> {
    const params = await this.getApiParams(integrationId);
    const request = {
      ...params,
      profileUrn,
      conversationUrn,
    };
    const response = await this.linkedinApiService.sendTypingIndicator(request);
    return !!response;
  }

  async processSeenMessage({ integrationId, conversationUrn, profileUrn }: { integrationId: string; profileUrn; conversationUrn: string }): Promise<boolean> {
    const params = await this.getApiParams(integrationId);
    const request = {
      ...params,
      profileUrn,
      conversationUrn,
    };
    const response = await this.linkedinApiService.seenMessage(request);
    return !!response;
  }

  async processSendReaction({ integrationId, urn_id }: SendReactRequest) {
    const params = await this.getApiParams(integrationId);
    const request = {
      ...params,
      urn_id,
      reaction: "LIKE",
    } as const;
    return await this.linkedinApiService.sendReactionToPost(request);
  }

  async processSkillEndorsement({ integrationId, urn_id }: SkillEndorsementRequest) {
    const params = await this.getApiParams(integrationId);
    const request = {
      ...params,
      urn_id,
    } as const;
    return await this.linkedinApiService.endorseSkill(request);
  }

  async processFollow({ integrationId, urn_id }: FollowRequest) {
    const params = await this.getApiParams(integrationId);
    const request = {
      ...params,
      urn_id,
    } as const;
    return await this.linkedinApiService.follow(request);
  }

  async processInvitation({ integrationId, urn_id, message }: InvitationRequest) {
    const params = await this.getApiParams(integrationId);
    const request = {
      ...params,
      urn_id,
      message,
    } as const;
    return await this.linkedinApiService.sendInvite(request);
  }

  async processInMail({ integrationId, targetUrn, message, subject, mailboxUrn, isPremium }: InMailRequest): Promise<Response<InMailResponse>> {
    const params = await this.getApiParams(integrationId);
    return await this.linkedinApiService.sendInMail({
      ...params,
      recipients: [targetUrn],
      mailboxUrn,
      message,
      subject,
      isPremium,
    });
  }

  private async handleSessionError(request: EngineRequest, logContext: string, errorMessage: string, shouldRetry: boolean): Promise<void> {
    this.logger.error(`${logContext} - ${errorMessage}`);
    for (const action of request.actions) {
      const actionError = this.generateActionError(`${logContext} - ${errorMessage}`, shouldRetry);
      await this.publishResponse(logContext, request.integrationId, request.campaignId, action, actionError);
    }
  }

  private generateActionError(message: string, shouldRetry: boolean): ErrorResponse {
    return {
      success: false,
      message,
      shouldRetry,
    };
  }

  private async publishResponse(logContext: string, integrationId: string, campaignId: string, action: ActionData & ActionReqInfo, response: LinkedinServiceResponse) {
    if (response.success === false) {
      this.logger.error(`${logContext} - Campaign ${campaignId} - Action ${action.type} - ${response.message}`);
      const errorResponse = this.generateActionError(response.message, response.shouldRetry);
      return await this.publisher.notifyErrorEngineResponse({ integrationId, campaignId, ...errorResponse, ...action });
    }
    const { success, ...rest } = response;
    const engineResponse: EngineResponse = {
      integrationId,
      campaignId,
      version: 0,
      audienceId: action.audienceId,
      profileId: action.profileId,
      leadId: action.leadId,
      ...rest,
    };
    await this.publisher.notifySuccessfulEngineResponse(engineResponse);
  }

  async checkSearchUrl({ integrationId, searchUrl }: CheckSearchUrlRequest): Promise<CheckSearchUrlResponse> {
    this.logger.log(`Manager - CheckSearchUrl - integration: ${integrationId} - searchUrl - ${searchUrl}`);
    const response = await this.processSearchResults({ integrationId, searchUrl, count: 25, start: 0 });
    if (!response.success) {
      return { integrationId, isValid: false, total: 0, needPremium: false };
    }

    const { leads, total } = response;
    return { integrationId, isValid: true, total, needPremium: leads.length <= 5 && 5 < total };
  }

  async processSearchResults({ integrationId, count, ...req }: FetchSearchResult): Promise<
    Response<{
      leads: SearchPeople[];
      total: number;
      query: string;
    }>
  > {
    this.logger.log(`Manager - processSearchResults - integration: ${integrationId} - count - ${count} - rest - ${JSON.stringify(req)}`);
    const params = await this.getApiParams(integrationId);
    if ("query" in req && !!req.query) {
      const { query } = req;
      const searchResult = await this.linkedinApiService.getSearchResults({
        ...params,
        query,
        start: req.start,
        count,
      });
      this.logger.debug(`Manager - processSearchResults - integration: ${integrationId} - searchResult - ${JSON.stringify(searchResult)}`);

      if (searchResult.success === false) {
        return searchResult;
      }
      const { result, total } = searchResult;
      return { success: true, leads: result, total, query };
    }

    const searchResult = await this.linkedinApiService.getSearchResults({
      ...params,
      searchUrl: req.searchUrl,
      start: req.start,
      count,
    });
    this.logger.debug(`Manager - processSearchResults - integration: ${integrationId} - searchResult - ${JSON.stringify(searchResult)}`);
    if (searchResult.success === false) {
      return searchResult;
    }
    const { result, total, query } = searchResult;
    return { success: true, leads: result, total, query };
  }

  public async handleEngineRequestApi(request: EngineRequest): Promise<void> {
    const { integrationId, campaignId, actions } = request;
    const logContext = `Integration ${integrationId} - Campaign ${campaignId} - Linkedin Service `;
    this.logger.log(`${logContext} - Processing Engine Request - ${JSON.stringify(request)}`);

    const session = (await this.linkedinSession.getSession(integrationId)) as LinkedinSession;
    if (!session) {
      this.logger.debug(`${logContext} - No session found`);
      await this.handleSessionError(request, logContext, "No session found", true);
      // TODO: need to retry
      return;
    }
    const apiActions: EngineRequest["actions"] = [];

    for (const action of actions) {
      if (this.API_CALL_ACTIONS.includes(action.type)) {
        this.logger.debug(`${logContext} - Added to Api Action - ${JSON.stringify(action)}`);
        apiActions.push(action);
      } else {
        this.logger.warn(`${logContext} - Unsupported API Action - ${JSON.stringify(action)}`);
        await this.publisher.notifyBrowserAction(request);
      }
    }
    this.logger.warn(`${JSON.stringify(apiActions)}`);
    for (const action of apiActions) {
      await new Promise(resolve => setTimeout(resolve, 1000 * randomBetween(15, 45)));
      let response = null;
      switch (action.type) {
        case ActionType.PROFILE_FETCH: {
          const response = await this.processProfileInformation({ integrationId: request.integrationId, urn_id: action.profileId });
          this.logger.debug(`${logContext} - Processed Profile Information - ${JSON.stringify(response)}`);
          if (response.profile && response.profile.publicIdentifier) {
            const engineResponse: EngineResponse = {
              integrationId,
              campaignId,
              version: 0,
              audienceId: action.audienceId,
              profileId: action.profileId,
              leadId: action.leadId,
              type: ActionType.PROFILE_FETCH,
              profile: {
                urnId: response.profile.urn_id,
                publicId: response.profile.publicIdentifier,
                firstName: response.profile.firstName,
                lastName: response.profile.lastName,
                headline: response.profile.headline,
                profileUrl: `https://www.linkedin.com/in/${response.profile.publicIdentifier}`,
                propicUrl: response.profile.profilePicUrl,
                country: response.profile.country,
                company: response.profile.company,
                currentPosition: response.profile.current_position,
                inEmployment: response.profile.stillWorking,
                school: response.profile.school,
                industries: response.profile.industries,
                email: response.profile.email ?? "",
                phone: response.profile.phoneNumbers.length ? response.profile.phoneNumbers[0].phoneNumber : "",
                numberOfConnection: "",
              },
            };
            await this.publisher.notifySuccessfulEngineResponse(engineResponse);
          } else {
            this.logger.debug(`Campaign ${request.campaignId} - Engine Processor - unable to fetch profile for audience ${action.audienceId}`);
            await this.publisher.notifyErrorEngineResponse({
              integrationId: integrationId,
              campaignId: campaignId,
              success: false,
              shouldRetry: true,
              message: "Unable to fetch profile",
              ...action,
            });
          }
          break;
        }
        case ActionType.SEND_MESSAGE:
          response = await this.processSendMessage({ integrationId: integrationId, message: action.data.message, recipientUrn: action.profileId });
          this.logger.debug(`${logContext} - Processed Send Message - ${JSON.stringify(response)}`);
          if (response) {
            await this.publisher.notifySuccessfulEngineResponse({
              integrationId,
              campaignId,
              version: 0,
              audienceId: action.audienceId,
              profileId: action.profileId,
              leadId: action.leadId,
              type: ActionType.SEND_MESSAGE,
            });
          } else {
            // Todo: have to detect the error reason and retry mechanism.
            await this.publisher.notifyErrorEngineResponse({
              integrationId,
              campaignId,
              success: false,
              shouldRetry: false,
              message: "Unable to send message",
              ...action,
            });
          }
          break;
        case ActionType.LIKE_POST:
          response = await this.processSendReaction({ integrationId: integrationId, urn_id: action.profileId });
          this.logger.debug(`${logContext} - Processed Send Reaction - ${JSON.stringify(response)}`);
          if (response) {
            await this.publisher.notifySuccessfulEngineResponse({
              integrationId,
              campaignId,
              version: 0,
              audienceId: action.audienceId,
              profileId: action.profileId,
              leadId: action.leadId,
              type: ActionType.LIKE_POST,
            });
          } else {
            await this.publisher.notifyErrorEngineResponse({
              integrationId,
              campaignId,
              success: false,
              shouldRetry: false,
              message: "Unable to react to any kind of post",
              ...action,
            });
          }
          break;
        case ActionType.ENDORSE_SKILL:
          response = await this.processSkillEndorsement({ integrationId: integrationId, urn_id: action.profileId });
          this.logger.debug(`${logContext} - Processed Skill Endorsement - ${JSON.stringify(response)}`);
          if (response) {
            await this.publisher.notifySuccessfulEngineResponse({
              integrationId,
              campaignId,
              version: 0,
              audienceId: action.audienceId,
              profileId: action.profileId,
              leadId: action.leadId,
              type: ActionType.ENDORSE_SKILL,
            });
          } else {
            await this.publisher.notifyErrorEngineResponse({
              integrationId,
              campaignId,
              success: false,
              shouldRetry: false,
              message: "Unable to endorse post",
              ...action,
            });
          }
          break;
        case ActionType.FOLLOW_REQUEST:
          response = await this.processFollow({ integrationId: integrationId, urn_id: action.profileId });
          this.logger.debug(`${logContext} - Processed Follow Request - ${JSON.stringify(response)}`);
          if (response) {
            await this.publisher.notifySuccessfulEngineResponse({
              integrationId,
              campaignId,
              version: 0,
              audienceId: action.audienceId,
              profileId: action.profileId,
              leadId: action.leadId,
              type: ActionType.FOLLOW_REQUEST,
            });
          } else {
            await this.publisher.notifyErrorEngineResponse({
              integrationId,
              campaignId,
              success: false,
              shouldRetry: false,
              message: "Unable to follow",
              ...action,
            });
          }
          break;
        case ActionType.SEND_INVITE:
          const res = await this.processInvitation({ integrationId: integrationId, urn_id: action.profileId, message: action.data.message });
          this.logger.debug(`${logContext} - Processed Send Invite - ${JSON.stringify(res)}`);
          if (res.success === "true") {
            await this.publisher.notifySuccessfulEngineResponse({
              integrationId,
              campaignId,
              version: 0,
              audienceId: action.audienceId,
              profileId: action.profileId,
              leadId: action.leadId,
              type: ActionType.SEND_INVITE,
            });
          } else if (res.errorReason === "WEEKLY_LIMIT_REACHED") {
            this.logger.warn(`${logContext} - Processed Send Invite - Weekly limit reached.`);
            // This will handle the other functionality to stop sending invitation for a day.
            await this.publisher.notifyErrorEngineResponse({
              integrationId,
              campaignId,
              success: false,
              shouldRetry: true,
              message: "Unable to send invitation for a day. Limit reached.",
              ...action,
            });
          } else {
            // Will try with Browser automation if we fail to send invite via API.
            // automationActions.push(action);
            // this.publisher.notifyBrowserAction(request);
            await this.publisher.notifyErrorEngineResponse({
              integrationId,
              campaignId,
              success: false,
              shouldRetry: true,
              message: "Unable to send invitation. Will retry again.",
              ...action,
            });
          }
          break;
        case ActionType.WITHDRAW_INVITE:
          response = await this.processWithdrawInvitation({
            integrationId: integrationId,
            urn_id: action.profileId,
            action: "withdraw",
            invitationId: `Campaign Action: No Invitation Id`,
          });
          this.logger.debug(`${logContext} - Processed Withdraw Invite - ${JSON.stringify(response)}`);
          if (response.success) {
            await this.publisher.notifySuccessfulEngineResponse({
              integrationId,
              campaignId,
              version: 0,
              audienceId: action.audienceId,
              profileId: action.profileId,
              leadId: action.leadId,
              type: ActionType.WITHDRAW_INVITE,
            });
          } else {
            // Will try with Browser automation if we fail to send invite via API.
            this.publisher.notifyBrowserAction(request);
          }
          break;
        case ActionType.SEND_INEMAIL:
          response = await this.processInMail({
            integrationId: integrationId,
            targetUrn: action.profileId,
            message: action.data.message,
            subject: action.data.subject,
            mailboxUrn: action.data.mailboxUrn,
            isPremium: action.data.isPremium,
          });
          this.logger.debug(`${logContext} - Processed Send InEmail - ${JSON.stringify(response)}`);
          if (response.success) {
            await this.publisher.notifySuccessfulEngineResponse({
              integrationId,
              campaignId,
              version: 0,
              audienceId: action.audienceId,
              profileId: action.profileId,
              leadId: action.leadId,
              type: ActionType.SEND_INEMAIL,
            });
          } else {
            await this.publisher.notifyErrorEngineResponse({
              integrationId,
              campaignId,
              success: false,
              shouldRetry: false,
              message: response?.message?.split(".")[0] || response?.reason || "Not Enough Inmail Credit",
              ...action,
            });
          }
          break;
        default:
          break;
      }
    }
  }

  public async handleEngineRequestBrowserApi(request: EngineRequest): Promise<void> {
    const { integrationId, campaignId } = request;
    const logContext = `Integration ${integrationId} - Campaign ${campaignId} - Linkedin Service `;
    this.logger.log(`${logContext} - Processing Engine Request - ${JSON.stringify(request)}`);

    const session = (await this.linkedinSession.getSession(integrationId)) as LinkedinSession;
    if (!session) {
      this.logger.debug(`${logContext} - No session found`);
      await this.handleSessionError(request, logContext, "No session found", true);
      // TODO: need to retry
      return;
    }
    this.logger.debug(`${logContext} - Processing Automation Actions - ${JSON.stringify(request)}`);
    await this.linkedinAutomation.handleEngineRequests(request, session);
  }
}
