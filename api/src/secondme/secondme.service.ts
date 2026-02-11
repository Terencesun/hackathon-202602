import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { AxiosRequestConfig } from 'axios';
import type { Readable } from 'stream';
import { collectSecondMeSseText } from './secondme.sse';
import type {
  SecondMeActStreamRequest,
  SecondMeApiResponse,
  SecondMeChatSessionListData,
  SecondMeChatSessionMessagesData,
  SecondMeChatStreamRequest,
  SecondMeNoteAddData,
  SecondMeNoteAddRequest,
  SecondMeOauthAuthorizeExternalData,
  SecondMeOauthAuthorizeExternalRequest,
  SecondMeOauthTokenData,
  SecondMeSoftMemoryData,
  SecondMeSseCollectResult,
  SecondMeTtsGenerateData,
  SecondMeTtsGenerateRequest,
  SecondMeUserInfoData,
  SecondMeUserShadesData,
} from './secondme.types';

@Injectable()
export class SecondmeService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  getBaseUrl(): string {
    return (
      this.configService.get<string>('SECONDME_API_URL') ||
      'https://app.mindos.com/gate/lab'
    );
  }

  async oauthAuthorizeExternal(
    userToken: string,
    payload: SecondMeOauthAuthorizeExternalRequest,
  ): Promise<SecondMeOauthAuthorizeExternalData> {
    return this.postJson<SecondMeOauthAuthorizeExternalData>(
      '/api/oauth/authorize/external',
      payload,
      { accessToken: userToken },
    );
  }

  async oauthTokenByCode(input: {
    code: string;
    redirectUri: string;
    clientId: string;
    clientSecret: string;
  }): Promise<SecondMeOauthTokenData> {
    const form = new URLSearchParams();
    form.set('grant_type', 'authorization_code');
    form.set('code', input.code);
    form.set('redirect_uri', input.redirectUri);
    form.set('client_id', input.clientId);
    form.set('client_secret', input.clientSecret);

    const url = `${this.getBaseUrl()}/api/oauth/token/code`;
    const response = await firstValueFrom(
      this.httpService.post<SecondMeApiResponse<SecondMeOauthTokenData>>(
        url,
        form.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      ),
    );

    return this.ensureOk(response.data, 'oauthTokenByCode');
  }

  async oauthTokenRefresh(input: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }): Promise<SecondMeOauthTokenData> {
    const form = new URLSearchParams();
    form.set('grant_type', 'refresh_token');
    form.set('refresh_token', input.refreshToken);
    form.set('client_id', input.clientId);
    form.set('client_secret', input.clientSecret);

    const url = `${this.getBaseUrl()}/api/oauth/token/refresh`;
    const response = await firstValueFrom(
      this.httpService.post<SecondMeApiResponse<SecondMeOauthTokenData>>(
        url,
        form.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      ),
    );

    return this.ensureOk(response.data, 'oauthTokenRefresh');
  }

  async userInfo(accessToken: string): Promise<SecondMeUserInfoData> {
    return this.getJson<SecondMeUserInfoData>('/api/secondme/user/info', {
      accessToken,
    });
  }

  async userShades(accessToken: string): Promise<SecondMeUserShadesData> {
    return this.getJson<SecondMeUserShadesData>('/api/secondme/user/shades', {
      accessToken,
    });
  }

  async userSoftMemory(
    accessToken: string,
    params?: { keyword?: string; pageNo?: number; pageSize?: number },
  ): Promise<SecondMeSoftMemoryData> {
    return this.getJson<SecondMeSoftMemoryData>(
      '/api/secondme/user/softmemory',
      {
        accessToken,
        params,
      },
    );
  }

  async noteAdd(
    accessToken: string,
    payload: SecondMeNoteAddRequest,
  ): Promise<SecondMeNoteAddData> {
    return this.postJson<SecondMeNoteAddData>(
      '/api/secondme/note/add',
      payload,
      {
        accessToken,
      },
    );
  }

  async ttsGenerate(
    accessToken: string,
    payload: SecondMeTtsGenerateRequest,
  ): Promise<SecondMeTtsGenerateData> {
    return this.postJson<SecondMeTtsGenerateData>(
      '/api/secondme/tts/generate',
      payload,
      { accessToken },
    );
  }

  async chatSessionList(
    accessToken: string,
    params?: { appId?: string },
  ): Promise<SecondMeChatSessionListData> {
    return this.getJson<SecondMeChatSessionListData>(
      '/api/secondme/chat/session/list',
      { accessToken, params },
    );
  }

  async chatSessionMessages(
    accessToken: string,
    params: { sessionId: string },
  ): Promise<SecondMeChatSessionMessagesData> {
    return this.getJson<SecondMeChatSessionMessagesData>(
      '/api/secondme/chat/session/messages',
      { accessToken, params },
    );
  }

  async chatStreamRaw(
    accessToken: string,
    payload: SecondMeChatStreamRequest,
    headers?: { appId?: string },
  ): Promise<Readable> {
    const url = `${this.getBaseUrl()}/api/secondme/chat/stream`;
    const response = await firstValueFrom(
      this.httpService.post(url, payload, {
        headers: this.buildAuthHeaders(accessToken, headers),
        responseType: 'stream',
      }),
    );
    return response.data as Readable;
  }

  async chatStreamCollectText(
    accessToken: string,
    payload: SecondMeChatStreamRequest,
    headers?: { appId?: string },
  ): Promise<SecondMeSseCollectResult> {
    const stream = await this.chatStreamRaw(accessToken, payload, headers);
    return collectSecondMeSseText(stream);
  }

  async actStreamRaw(
    accessToken: string,
    payload: SecondMeActStreamRequest,
    headers?: { appId?: string },
  ): Promise<Readable> {
    const url = `${this.getBaseUrl()}/api/secondme/act/stream`;
    const response = await firstValueFrom(
      this.httpService.post(url, payload, {
        headers: this.buildAuthHeaders(accessToken, headers),
        responseType: 'stream',
      }),
    );
    return response.data as Readable;
  }

  async actStreamCollectText(
    accessToken: string,
    payload: SecondMeActStreamRequest,
    headers?: { appId?: string },
  ): Promise<SecondMeSseCollectResult> {
    const stream = await this.actStreamRaw(accessToken, payload, headers);
    return collectSecondMeSseText(stream);
  }

  private async getJson<TData>(
    path: string,
    input: { accessToken: string; params?: Record<string, unknown> },
  ): Promise<TData> {
    const url = `${this.getBaseUrl()}${path}`;
    const config: AxiosRequestConfig = {
      headers: this.buildAuthHeaders(input.accessToken),
      params: input.params,
    };
    const response = await firstValueFrom(
      this.httpService.get<SecondMeApiResponse<TData>>(url, config),
    );
    return this.ensureOk(response.data, path);
  }

  private async postJson<TData>(
    path: string,
    payload: unknown,
    input: { accessToken: string },
  ): Promise<TData> {
    const url = `${this.getBaseUrl()}${path}`;
    const response = await firstValueFrom(
      this.httpService.post<SecondMeApiResponse<TData>>(url, payload, {
        headers: this.buildAuthHeaders(input.accessToken),
      }),
    );
    return this.ensureOk(response.data, path);
  }

  private buildAuthHeaders(
    accessToken: string,
    extra?: { appId?: string },
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    if (extra?.appId) headers['X-App-Id'] = extra.appId;
    return headers;
  }

  private ensureOk<TData>(
    response: SecondMeApiResponse<TData>,
    hint: string,
  ): TData {
    if (!response || typeof response !== 'object') {
      throw new Error(`SecondMe API response invalid: ${hint}`);
    }
    if ((response as { code?: unknown }).code !== 0) {
      const code =
        typeof (response as { code?: unknown }).code === 'number'
          ? (response as { code: number }).code
          : -1;
      const message =
        typeof (response as { message?: unknown }).message === 'string'
          ? String((response as { message: string }).message)
          : 'SecondMe API error';
      const subCode =
        typeof (response as { subCode?: unknown }).subCode === 'string'
          ? String((response as { subCode: string }).subCode)
          : '';
      throw new Error(
        subCode ? `${message} (${code}) [${subCode}]` : `${message} (${code})`,
      );
    }
    return (response as { data: TData }).data;
  }
}
