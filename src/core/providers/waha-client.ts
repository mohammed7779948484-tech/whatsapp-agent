import { env } from '../env';
import { AppError, ErrorCode } from '../errors';

export interface WahaSessionResponse {
  name: string;
  status?: string;
  config?: {
    webhooks?: Array<{
      url: string;
      events?: string[];
      hmac?: {
        key?: string;
      };
    }>;
  };
  me?: {
    id?: string;
    pushName?: string;
  };
}

interface WahaClientOptions {
  baseUrl: string;
  apiKey: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

export class WahaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: WahaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
  }

  public async createSession(
    name: string,
    webhookUrl: string,
    hmacSecret: string
  ): Promise<WahaSessionResponse> {
    return this.request<WahaSessionResponse>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        name,
        config: {
          webhooks: [
            {
              url: webhookUrl,
              events: ['session.status', 'message'],
              hmac: {
                key: hmacSecret,
              },
            },
          ],
        },
      }),
    });
  }

  public async getSession(name: string): Promise<WahaSessionResponse> {
    return this.request<WahaSessionResponse>(`/api/sessions/${encodeURIComponent(name)}`);
  }

  public async deleteSession(name: string): Promise<void> {
    try {
      await this.request<void>(`/api/sessions/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        return;
      }

      throw error;
    }
  }

  public async getQrCode(session: string): Promise<{ mimetype: string; data: string }> {
    return this.request<{ mimetype: string; data: string }>(
      `/api/${encodeURIComponent(session)}/auth/qr?format=image`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );
  }

  public async sendText(session: string, chatId: string, text: string): Promise<void> {
    await this.request<void>('/api/sendText', {
      method: 'POST',
      body: JSON.stringify({
        session,
        chatId,
        text,
      }),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
          ...init.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppError('WAHA request failed', ErrorCode.WAHA_API_ERROR, 502, 'medium', {
          details: {
            responseStatus: response.status,
          },
        });
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AppError('WAHA request timed out', ErrorCode.WAHA_TIMEOUT, 504, 'medium');
      }

      throw new AppError('WAHA request failed', ErrorCode.WAHA_API_ERROR, 502, 'medium');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function createWahaClient(): WahaClient {
  if (!env.WAHA_BASE_URL || !env.WAHA_ADMIN_API_KEY) {
    throw new AppError('WAHA is not configured', ErrorCode.WAHA_NOT_CONFIGURED, 500, 'medium');
  }

  return new WahaClient({
    baseUrl: env.WAHA_BASE_URL,
    apiKey: env.WAHA_ADMIN_API_KEY,
  });
}
