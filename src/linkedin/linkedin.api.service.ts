import { Injectable, Logger } from "@nestjs/common";
import {
  Connection,
  Conversation,
  GetConversationListRequest,
  GetFirstDegreeConnectionsRequest,
  GetInvitationsRequest,
  GetMessagesRequest,
  GetProfileInformationRequest,
  GetSearchResultList,
  Invitation,
  SendReactionToPostRequest,
  ManageReceivedInvitationRequest,
  Message,
  SearchResult,
  SendMessageRequest,
  SendTypingRequest,
  WithdrawInvitationRequest,
  REACTION,
  EndorseSkillRequest,
  InvitationRequest,
  LinkedinInvitationResponse,
  GetIntegrationStatusRequest,
  IsProxyWorkingRequest,
  SendInMailRequest,
  InMailResponse,
  WithdrawInvitationResponse,
} from "./types/linkedin.types";
import { VoyegerApiService } from "./voyeger-api/voyeger.api.service";
import { LinkedinApiAdapter } from "./linkedin.api.adapter";
import { LinkedinApiErrorHandler } from "./linkedin.api.error.handler";
import { SalesApiService } from "./sales-api/sales.api.service";

@Injectable()
export class LinkedinApiService {
  private userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.5790.75 Safari/537.36";

  private logger: Logger = new Logger(LinkedinApiService.name);
  constructor(private voyager: VoyegerApiService, private sales: SalesApiService, private adapter: LinkedinApiAdapter, private linkedinApiErrorHandler: LinkedinApiErrorHandler) {
    
  }

  async isProxyWorking({ logContext, proxy, cookies, userAgent }: IsProxyWorkingRequest) {
    try {
      this.logger.debug(`IS_PROXY_WORKING Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length, userAgent })}`);
      return await this.voyager.isProxyWorking({ proxy, cookies, userAgent: userAgent });
    } catch (error) {
      this.logger.error(`LinkedinApiService - isProxyWorking - ${logContext.text} - error - ${error.message} `);
      return false;
    }
  }

  async getFirstDegreeConnections({ logContext, proxy, cookies, userAgent, start, count }: GetFirstDegreeConnectionsRequest): Promise<Response<{ connections: Connection[] }>> {
    try {
      this.logger.debug(`GET_FIRST_DEGREE Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const response = await this.voyager.fetchConnections({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        start,
        count,
      });
      return { success: true, connections: this.adapter.voyegerToFirstDegreeConnections(response) };
    } catch (error) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(error, logContext);
      this.logger.error(`LinkedinApiService - getFirstDegreeConnections - ${logContext.text} - error - ${error.message} `);
      return { success: false, message: error.message, reason: error };
    }
  }

  async getInvitations({ logContext, start, count, userAgent, invitationType, proxy, cookies }: GetInvitationsRequest): Promise<Response<{ invitations: Invitation[] }>> {
    try {
      this.logger.debug(`GET_INVITATION Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const response = await this.voyager.fetchInvitations({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        start,
        count,
        invitationType,
      });
      return { success: true, invitations: this.adapter.voyegerToInvitations(response) };
    } catch (error) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(error, logContext);
      this.logger.error(`LinkedinApiService - getInvitations - ${logContext.text} - error - ${error.message} `);
      return { success: false, message: error.message, reason: error };
    }
  }

  // This function dosent support 'start'
  async getConversationList({ logContext, count, createdBefore, createdAfter, proxy, cookies, userAgent }: GetConversationListRequest): Promise<Conversation[]> {
    try {
      // TODO: Update database to set limit
      this.logger.debug(`GET_CONVERSATION_LIST Voyager Api Call - ${logContext.text} - Body:  ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const response = await this.voyager.fetchConversationList({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        count,
        createdAfter,
        createdBefore,
      });
      return this.adapter.voyegerToConversationList(response);
    } catch (error) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(error, logContext);
      this.logger.error(`LinkedinApiService - getConversationList - ${logContext.text} - error - ${error.message} `);
      return [];
    }
  }
  async getMessages({ logContext, count, start, proxy, cookies, userAgent, conversationUrn, createdBefore, createdAfter }: GetMessagesRequest): Promise<Message[]> {
    try {
      // TODO: Update database to set limit
      this.logger.debug(`GET_MESSAGES Voyager Api Call - ${logContext.text} - Body:  ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const response = await this.voyager.fetchMessages({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        count,
        start,
        conversationUrn,
        createdBefore,
        createdAfter,
      });
      return this.adapter.voyegerToMessages(response);
    } catch (error) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(error, logContext);
      this.logger.error(`LinkedinApiService - getMessages -${logContext.text} - error - ${error.message} `);
      return [];
    }
  }

  async manageReceivedInvitation({ logContext, proxy, cookies, userAgent, action, sharedSecret, mailboxItemId }: ManageReceivedInvitationRequest): Promise<boolean> {
    try {
      // TODO: Update database to set limit
      this.logger.debug(`MANAGE_INVITATION Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const response = await this.voyager.manageInvitation({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        action,
        sharedSecret,
        mailboxItemId,
      });

      return response?.value?.invitationType === "RECEIVED";
    } catch (error) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(error, logContext);
      this.logger.error(`LinkedinApiService - manageReceivedInvitation - ${logContext.text} - error - ${error.message} `);
      return false;
    }
  }

  async withdrawInvitation({ logContext, proxy, cookies, userAgent, mailboxItemId, urn_id }: WithdrawInvitationRequest): Promise<WithdrawInvitationResponse> {
    try {
      if (!mailboxItemId) {
        if (!urn_id) {
          this.logger.error(`LinkedinApiService - withdrawInvitation - ${logContext.text} - error - urn_id or mailboxItemId is required`);
          return { success: false };
        }

        const res = await this.voyager.fetchHTML({
          proxy,
          cookies,
          userAgent: userAgent ?? this.userAgent,
          searchUrl: `https://www.linkedin.com/in/${urn_id}`,
        });
        mailboxItemId = this.adapter.parseInvitationIdFromHTML(res);
        if (!mailboxItemId) {
          this.logger.error(`WITHDRAW_INVITATION Voyager Api Call - ${logContext.text} - fetched mailboxItemId: ${mailboxItemId} - urn_id: ${urn_id} - Stopping voyeger call.`);
          return { success: false };
        }
        this.logger.debug(`WITHDRAW_INVITATION Voyager Api Call - ${logContext.text} - fetched mailboxItemId: ${mailboxItemId} - urn_id: ${urn_id}`);
      }
      // TODO: Update database to set limit
      this.logger.debug(`WITHDRAW_INVITATION Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const response = await this.voyager.manageInvitation({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        action: "withdraw",
        mailboxItemId,
      });

      return { success: response?.value?.invitationType === "SENT", mailboxItemId: mailboxItemId?.slice(22) ?? "", urn_id: urn_id ?? "" };
    } catch (error) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(error, logContext);
      this.logger.error(`LinkedinApiService - withdrawInvitation - ${logContext.text} - error - ${error.message} `);
      return { success: false };
    }
  }
  async checkIntegrationStatus({ logContext, proxy, cookies, userAgent }: GetIntegrationStatusRequest): Promise<boolean> {
    try {
      this.logger.debug(`CHECK_INTEGRATION_STATUS Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const response = await this.voyager.fetchContactInformation({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        urn_id: "me",
      });
      const info = this.adapter.voyegerToContactInformation(response);
      this.logger.debug(`CHECK_INTEGRATION_STATUS Voyager Api Call - ${logContext.text} - fetched info: ${JSON.stringify(info)}`);
      return Boolean(info);
    } catch (error) {
      const message = error.message;
      let status = null;
      if ("response" in error) {
        status = error.response.status || error.response?.data?.status;
      }
      this.logger.error(`🚀 ~ LinkedinApiErrorHandler - handleVoyagerApiError - context - ${logContext.text} -  message - ${message} - status - ${status} - error: ${error}`);
      return false;
    }
  }

  async getProfile({ logContext, proxy, cookies, userAgent, urn_id = "me" }: GetProfileInformationRequest | null) {
    try {
      this.logger.debug(`PERSONAL_PROFILE Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const response = await this.voyager.fetchProfileInformation({
        proxy,
        cookies,
        urn_id,
        userAgent: userAgent ?? this.userAgent,
      });
      const profileInfo = this.adapter.voyegerToProfileInformation(response);
      const contactResponse = await this.voyager.fetchContactInformation({
        proxy,
        cookies,
        urn_id,
        userAgent: userAgent ?? this.userAgent,
      });
      const contactInfo = this.adapter.voyegerToContactInformation(contactResponse);
      this.logger.warn(
        `LinkedinApiService - getPersonalProfile - ${logContext.text} - fetched profileInfo: ${JSON.stringify(profileInfo)} - contactInfo: ${JSON.stringify(contactInfo)}`,
      );
      return { ...profileInfo, ...contactInfo };
    } catch (error) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(error, logContext);
      this.logger.error(`LinkedinApiService - getPersonalProfile - ${logContext.text} - error - ${error.message} `);
      return null;
    }
  }

  async sendMessage({ logContext, proxy, cookies, userAgent, message, ...req }: SendMessageRequest): Promise<boolean> {
    try {
      this.logger.debug(`SEND_MESSAGE Voyager Api Call - ${logContext.text} - message - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const response = await this.voyager.sendMessage({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        message,
        ...req,
      });
      return Boolean(response.value);
    } catch (error) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(error, logContext);
      this.logger.error(`LinkedinApiService - sendMessage - ${logContext.text} - error - ${error.message} `);
      return false;
    }
  }
  async sendTypingIndicator({ logContext, proxy, cookies, userAgent, profileUrn, conversationUrn }: SendTypingRequest): Promise<boolean> {
    try {
      this.logger.debug(`SET_TYPING Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const response = await this.voyager.sendTypingIndicator({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        profileUrn,
        conversationUrn,
      });
      return Boolean(response);
    } catch (error) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(error, logContext);
      this.logger.error(`LinkedinApiService - sendTyping - ${logContext.text} - error - ${error.message} `);
      return false;
    }
  }

  async getSearchResults({ logContext, proxy, cookies, userAgent, start = 0, count = 50, ...req }: GetSearchResultList): Promise<Response<SearchResult>> {
    try {
      this.logger.debug(`GET SEARCH LIST - Voyager/Sales Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length, ...req })}`);
      if ("searchUrl" in req) {
        const searchUrl = new URL(req.searchUrl);
        const isSalesNavigatorUrl = searchUrl.pathname.startsWith("/sales/");
        if (isSalesNavigatorUrl) {
          const response = await this.sales.fetchSearchResults({
            start,
            count,
            proxy,
            cookies,
            userAgent: userAgent ?? this.userAgent,
            searchUrl: req.searchUrl,
          });
          return { success: true, ...this.adapter.salesToSearchResults(response), query: null };
        }
        const searchHTML = await this.voyager.fetchHTML({
          proxy,
          cookies,
          userAgent: userAgent ?? this.userAgent,
          searchUrl: req.searchUrl,
        });

        const queryUrl = this.adapter.parseQueryFromHTML(searchHTML);
        const updatedQueryUrl = queryUrl.replace("(start:0,", `(start:${start},count:${Math.min(count, 50)},`);

        const searchResults = await this.voyager.fetchSearchResultList({
          proxy,
          cookies,
          userAgent: userAgent ?? this.userAgent,
          queryUrl: updatedQueryUrl,
        });

        return {
          success: true,
          ...this.adapter.voyegerToSearchResults(searchResults),
          query: queryUrl,
        };
      }

      const updatedQueryUrl = req.query.replace("(start:0,", `(start:${start},count:${Math.min(count, 50)},`);

      const searchList = await this.voyager.fetchSearchResultList({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        queryUrl: updatedQueryUrl,
      });
      return {
        success: true,
        ...this.adapter.voyegerToSearchResults(searchList),
        query: req.query,
      };
    } catch (error) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(error, logContext);
      this.logger.error(`LinkedinApiService - getSearchList - ${logContext.text} - error - ${error.message} `);
      return { success: false, message: error.message, reason: error };
    }
  }

  async sendReactionToPost({ logContext, proxy, cookies, userAgent, urn_id, reaction = "LIKE" }: SendReactionToPostRequest): Promise<boolean> {
    try {
      this.logger.debug(`SEND_REACTION_TO_POST Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const activity = await this.voyager.fetchActivity({ proxy, cookies, userAgent: userAgent ?? this.userAgent, urn_id });
      const postUrn = this.adapter.voyagerToPostActivityUrn(activity);
      if (!postUrn) {
        this.logger.error(`LinkedinApiService - sendReactionToPost - ${logContext.text} - error - couldn't detect any post urn from: activity: ${JSON.stringify(activity)}`);
        return true;
      }
      this.logger.debug(`SEND_REACTION_TO_POST Voyager Api Call - ${logContext.text} - postUrn: ${postUrn}`);
      await this.voyager.sendReaction({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        reaction: REACTION[reaction],
        activityUrn: postUrn,
      });
      return true;
    } catch (error) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(error, logContext);
      this.logger.error(`LinkedinApiService - sendReactionToPost - ${logContext.text} - error - ${error.message} `);
      return false;
    }
  }

  async endorseSkill({ logContext, proxy, cookies, userAgent, urn_id }: EndorseSkillRequest): Promise<boolean> {
    try {
      this.logger.debug(`ENDORSE_SKILL Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const skillsResponse = await this.voyager.fetchSkills({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        urn_id,
        start: 0,
        count: 5,
      });
      const endorsedSkillUrn = this.adapter.voyegerToEndorseSkillUrn(skillsResponse);
      if (!endorsedSkillUrn) {
        return true;
      }
      return Boolean(await this.voyager.endorseSkill({ proxy, cookies, userAgent: userAgent ?? this.userAgent, endorsedSkillUrn }));
    } catch (err) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(err, logContext);
      this.logger.error(`LinkedinApiService - endorseSkill - ${logContext.text} - error - ${err.message} `);
      return false;
    }
  }

  async follow({ logContext, proxy, cookies, userAgent, urn_id }: EndorseSkillRequest): Promise<boolean> {
    try {
      this.logger.debug(`Follow Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      return (
        "" ===
        (await this.voyager.follow({
          proxy,
          cookies,
          userAgent: userAgent ?? this.userAgent,
          urn_id,
        }))
      );
    } catch (err) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(err, logContext);
      this.logger.error(`LinkedinApiService - follow - ${logContext.text} - error - ${err.message} `);
      return false;
    }
  }

  async sendInvite({ logContext, proxy, cookies, userAgent, urn_id, message }: InvitationRequest): Promise<LinkedinInvitationResponse> {
    try {
      this.logger.debug(`Send Invite Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const response = await this.voyager.sendInvite({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        urn_id,
        personalizedMessage: message,
      });
      switch (response.result) {
        case "SENT":
          return { success: "true" };
        case "WEEKLY_LIMIT_REACHED":
          this.logger.log(`LinkedinApiService - sendInvite - ${logContext.text} - Weekly limit reached`);
          return { success: "false", message: "Weekly limit reached", errorReason: "WEEKLY_LIMIT_REACHED" };
      }
    } catch (err) {
      this.logger.error(`LinkedinApiService - sendInvite - ${logContext.text} - error - ${err}`);
      this.linkedinApiErrorHandler.handleVoyagerApiError(err, logContext);
      return { success: "false", message: `${err.response}`, errorReason: err };
    }
  }

  async seenMessage({ logContext, proxy, cookies, userAgent, conversationUrn, profileUrn }: SendTypingRequest): Promise<boolean> {
    try {
      this.logger.debug(`SEEN_MESSAGE Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length })}`);
      const response = await this.voyager.seenMessage({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        conversationUrn,
        profileUrn,
      });
      return Boolean(response);
    } catch (error) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(error, logContext);
      this.logger.error(`LinkedinApiService - seenMessage - ${logContext.text} - error - ${error.message} `);
      return false;
    }
  }

  async sendInMail({ logContext, proxy, cookies, userAgent, subject, message, recipients, mailboxUrn, isPremium }: SendInMailRequest): Promise<Response<InMailResponse>> {
    try {
      this.logger.debug(`SEND_IN_MAIL Voyager Api Call - ${logContext.text} - Body: ${JSON.stringify({ proxy, cookieLength: cookies.length, recipients, mailboxUrn, message })}`);
      const voyagerResponse = await this.voyager.sendInMail({
        proxy,
        cookies,
        userAgent: userAgent ?? this.userAgent,
        title: subject,
        message,
        recipients,
        mailboxUrn,
      });

      this.logger.log(`LinkedinApiService - sendInMail - ${logContext.text} - response - ${JSON.stringify(voyagerResponse)}`);
      if (voyagerResponse.success) {
        return { success: true, ...this.adapter.parseVoyagerInMail(voyagerResponse) };
      }
      this.logger.debug(`LinkedinApiService - sendInMail - ${logContext.text} - Fail Reason - ${voyagerResponse.reason}`);
      let salesResponse;
      if (isPremium) {
        this.logger.debug(`🚀 LinkedinApiService - sendInMail - ${logContext.text} - Going to use sales navigator.`);
        salesResponse = await this.sales.sendInMail({ proxy, cookies, userAgent, message, recipients, subject });
        if (salesResponse.success) {
          return { success: true, ...this.adapter.parseSalesInMail(salesResponse) };
        }
        this.logger.warn(`LinkedinApiService - sendInMail - ${logContext.text} -  sales navigator response - Fail Reason - ${salesResponse.reason}`);
      }
      return { success: false, message: isPremium ? salesResponse.message : voyagerResponse.message, reason: isPremium ? salesResponse.reason : voyagerResponse.reason };
    } catch (error) {
      this.linkedinApiErrorHandler.handleVoyagerApiError(error, logContext);
      this.logger.error(`LinkedinApiService - InMail - ${logContext.text} - error - ${error.message} `);
      return { success: false, message: error.message, reason: "UNKNOWN_ERROR" };
    }
  }
}
