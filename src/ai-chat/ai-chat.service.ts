import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import type { AuthUser } from '../auth/types/auth-user.type';
import { SendAiChatMessageDto } from './dto/send-ai-chat-message.dto';
import { StartAiChatSessionDto } from './dto/start-ai-chat-session.dto';

type AiServiceTokenItem = {
  provider?: string;
  in?: number;
  out?: number;
};

type AiServiceEnvelope = {
  status?: string;
  data?: {
    reply?: unknown;
    tokens?: AiServiceTokenItem[];
  };
  message?: unknown;
};

type AiChatTokenUsageItem = {
  provider: string;
  input: number;
  output: number;
};

type AiChatGatewayResponse = {
  sessionId: string;
  reply: string;
  traceId: string;
  recordedAt: string;
  tokenUsage: {
    items: AiChatTokenUsageItem[];
    totalInput: number;
    totalOutput: number;
  };
};

type AiServiceHistoryItem = {
  id?: unknown;
  role?: unknown;
  content?: unknown;
  recorded_at?: unknown;
  session_id?: unknown;
  boundary_type?: unknown;
};

type AiServiceSystemEntryEnvelope = {
  status?: string;
  data?: AiServiceHistoryItem;
  message?: unknown;
};

type AiServiceHistoryEnvelope = {
  status?: string;
  data?: {
    items?: AiServiceHistoryItem[];
    next_cursor?: unknown;
    active_session_id?: unknown;
  };
  message?: unknown;
};

type AiChatHistoryItem = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  recordedAt: string;
  sessionId: string | null;
  boundaryType: string | null;
};

type AiChatHistoryResponse = {
  items: AiChatHistoryItem[];
  nextCursor: string | null;
  activeSessionId: string | null;
  traceId: string;
  recordedAt: string;
};

type AiChatClosedResponse = {
  sessionId: string;
  traceId: string;
  recordedAt: string;
  status: 'closed';
};

type AiChatSystemEntryResponse = {
  item: AiChatHistoryItem;
  traceId: string;
  recordedAt: string;
};

type AiChatStatusResponse = {
  service: 'lifelines-ai';
  reachable: boolean;
  traceId: string;
  recordedAt: string;
  health: {
    path: string;
    status?: string;
  };
  routes: {
    sessionStartPath: string;
    messagePath: string;
    sessionClosePath: string;
    historyPath: string;
    systemTimelinePath: string;
  };
  errorMessage?: string;
};

type AiServiceRouteConfig = {
  healthPath: string;
  sessionStartPath: string;
  messagePath: string;
  sessionClosePath: string;
  historyPath: string;
  systemTimelinePath: string;
};

const AI_GATEWAY_HEADER_NAME = 'X-Lifelines-Gateway-Key';

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(private readonly configService: ConfigService) {}

  async getStatus(incomingTraceId?: string): Promise<AiChatStatusResponse> {
    const traceId = this.resolveTraceId(incomingTraceId, 'status');
    const startedAt = Date.now();
    const routeConfig = this.resolveRouteConfig();

    this.logAudit('log', 'api.ai_chat.status.requested', traceId, {
      upstream_health_path: routeConfig.healthPath,
      upstream_session_start_path: routeConfig.sessionStartPath,
      upstream_message_path: routeConfig.messagePath,
      upstream_session_close_path: routeConfig.sessionClosePath,
      upstream_history_path: routeConfig.historyPath,
      upstream_system_timeline_path: routeConfig.systemTimelinePath,
    });

    try {
      const response = await fetch(
        `${this.resolveAiBaseUrl()}${routeConfig.healthPath}`,
        {
          method: 'GET',
          headers: this.buildAiHeaders(traceId, false),
          signal: AbortSignal.timeout(this.resolveTimeoutMs()),
        },
      );

      const rawText = await response.text();
      const parsedBody = this.parseBody(rawText);
      const statusValue = (parsedBody as { status?: unknown } | undefined)
        ?.status;
      const reachable = response.ok;
      const healthStatus =
        typeof statusValue === 'string'
          ? statusValue
          : response.ok
            ? 'ok'
            : 'unavailable';
      const errorMessage = reachable
        ? undefined
        : this.extractErrorMessage(parsedBody, rawText) ||
          `AI service returned ${response.status}`;

      this.logAudit(
        reachable ? 'log' : 'error',
        reachable
          ? 'api.ai_chat.status.completed'
          : 'api.ai_chat.status.failed',
        traceId,
        {
          latency_ms: Date.now() - startedAt,
          upstream_health_path: routeConfig.healthPath,
          upstream_status: healthStatus,
          error_message: errorMessage,
        },
      );

      return {
        service: 'lifelines-ai',
        reachable,
        traceId,
        recordedAt: new Date().toISOString(),
        health: {
          path: routeConfig.healthPath,
          status: healthStatus,
        },
        routes: {
          sessionStartPath: routeConfig.sessionStartPath,
          messagePath: routeConfig.messagePath,
          sessionClosePath: routeConfig.sessionClosePath,
          historyPath: routeConfig.historyPath,
          systemTimelinePath: routeConfig.systemTimelinePath,
        },
        errorMessage,
      };
    } catch (error) {
      const errorMessage = this.serializeException(error);

      this.logAudit('error', 'api.ai_chat.status.failed', traceId, {
        latency_ms: Date.now() - startedAt,
        upstream_health_path: routeConfig.healthPath,
        error_type: error instanceof Error ? error.name : 'UnknownError',
        error_message: errorMessage,
      });

      return {
        service: 'lifelines-ai',
        reachable: false,
        traceId,
        recordedAt: new Date().toISOString(),
        health: {
          path: routeConfig.healthPath,
        },
        routes: {
          sessionStartPath: routeConfig.sessionStartPath,
          messagePath: routeConfig.messagePath,
          sessionClosePath: routeConfig.sessionClosePath,
          historyPath: routeConfig.historyPath,
          systemTimelinePath: routeConfig.systemTimelinePath,
        },
        errorMessage,
      };
    }
  }

  async createSystemTimelineEntry(
    user: AuthUser,
    payload: { sessionId: string; content: string; boundaryType: string },
    incomingTraceId?: string,
  ): Promise<AiChatSystemEntryResponse> {
    const routeConfig = this.resolveRouteConfig();
    const traceId = this.resolveTraceId(incomingTraceId, payload.sessionId);
    const startedAt = Date.now();
    const userHash = this.hashUserId(user.id);

    this.logAudit('log', 'api.ai_chat.timeline_system.requested', traceId, {
      session_id: payload.sessionId,
      user_id_hash: userHash,
      boundary_type: payload.boundaryType,
      message_length: payload.content.length,
      upstream_path: routeConfig.systemTimelinePath,
    });

    const response = await this.postJson(
      routeConfig.systemTimelinePath,
      traceId,
      {
        session_id: payload.sessionId,
        user_id: user.id,
        content: payload.content,
        boundary_type: payload.boundaryType,
      },
    );

    const item = this.normalizeSystemEntryResponse(response, traceId);

    this.logAudit('log', 'api.ai_chat.timeline_system.completed', traceId, {
      session_id: payload.sessionId,
      user_id_hash: userHash,
      boundary_type: payload.boundaryType,
      latency_ms: Date.now() - startedAt,
      message_length: payload.content.length,
      upstream_path: routeConfig.systemTimelinePath,
    });

    return {
      item,
      traceId,
      recordedAt: new Date().toISOString(),
    };
  }

  async getHistory(
    user: AuthUser,
    query: { cursor?: string; limit?: string },
    incomingTraceId?: string,
  ): Promise<AiChatHistoryResponse> {
    const routeConfig = this.resolveRouteConfig();
    const traceId = this.resolveTraceId(incomingTraceId, 'history');
    const startedAt = Date.now();
    const userHash = this.hashUserId(user.id);
    const limit = this.normalizeHistoryLimit(query.limit);

    this.logAudit('log', 'api.ai_chat.history.requested', traceId, {
      user_id_hash: userHash,
      cursor: query.cursor,
      limit,
      upstream_path: routeConfig.historyPath,
    });

    const params = new URLSearchParams({
      user_id: user.id,
      limit: String(limit),
    });
    if (query.cursor?.trim()) {
      params.set('cursor', query.cursor.trim());
    }

    const response = await this.getJson(
      `${routeConfig.historyPath}?${params.toString()}`,
      traceId,
    );
    const normalized = this.normalizeHistoryResponse(response, traceId);

    this.logAudit('log', 'api.ai_chat.history.completed', traceId, {
      user_id_hash: userHash,
      latency_ms: Date.now() - startedAt,
      item_count: normalized.items.length,
      next_cursor: normalized.nextCursor,
      upstream_path: routeConfig.historyPath,
    });

    return normalized;
  }

  async startSession(
    user: AuthUser,
    dto: StartAiChatSessionDto,
    incomingTraceId?: string,
  ): Promise<AiChatGatewayResponse> {
    const routeConfig = this.resolveRouteConfig();
    const sessionId = dto.sessionId?.trim() || randomUUID();
    const traceId = this.resolveTraceId(incomingTraceId, sessionId);
    const startedAt = Date.now();
    const userHash = this.hashUserId(user.id);

    this.logAudit('log', 'api.ai_chat.session_start.requested', traceId, {
      session_id: sessionId,
      user_id_hash: userHash,
      personality: dto.personality,
      language: dto.language,
      memory_enabled: dto.memoryEnabled,
      has_initial_message: Boolean(dto.message?.trim()),
      upstream_path: routeConfig.sessionStartPath,
    });

    const response = await this.postJson(routeConfig.sessionStartPath, traceId, {
      session_id: sessionId,
      user_id: user.id,
      personality: dto.personality,
      message: dto.message?.trim() || null,
      summaries: {
        profile: '',
        context: '',
        weekly: '',
      },
      greeting: dto.greeting,
      memory_enabled: dto.memoryEnabled,
      language: dto.language,
    });

    const normalized = this.normalizeSuccessResponse(
      response,
      sessionId,
      traceId,
    );

    this.logAudit('log', 'api.ai_chat.session_start.completed', traceId, {
      session_id: sessionId,
      user_id_hash: userHash,
      latency_ms: Date.now() - startedAt,
      reply_length: normalized.reply.length,
      token_input_total: normalized.tokenUsage.totalInput,
      token_output_total: normalized.tokenUsage.totalOutput,
      upstream_path: routeConfig.sessionStartPath,
    });

    return normalized;
  }

  async sendMessage(
    user: AuthUser,
    dto: SendAiChatMessageDto,
    incomingTraceId?: string,
  ): Promise<AiChatGatewayResponse> {
    const routeConfig = this.resolveRouteConfig();
    const sessionId = dto.sessionId.trim();
    const traceId = this.resolveTraceId(incomingTraceId, sessionId);
    const startedAt = Date.now();
    const userHash = this.hashUserId(user.id);
    const message = dto.message.trim();

    this.logAudit('log', 'api.ai_chat.message.requested', traceId, {
      session_id: sessionId,
      user_id_hash: userHash,
      personality: dto.personality,
      language: dto.language,
      memory_enabled: dto.memoryEnabled,
      message_length: message.length,
      upstream_path: routeConfig.messagePath,
    });

    const response = await this.postJson(routeConfig.messagePath, traceId, {
      session_id: sessionId,
      user_id: user.id,
      message,
      personality: dto.personality,
      memory_enabled: dto.memoryEnabled,
      language: dto.language,
    });

    const normalized = this.normalizeSuccessResponse(
      response,
      sessionId,
      traceId,
    );

    this.logAudit('log', 'api.ai_chat.message.completed', traceId, {
      session_id: sessionId,
      user_id_hash: userHash,
      latency_ms: Date.now() - startedAt,
      message_length: message.length,
      reply_length: normalized.reply.length,
      token_input_total: normalized.tokenUsage.totalInput,
      token_output_total: normalized.tokenUsage.totalOutput,
      upstream_path: routeConfig.messagePath,
    });

    return normalized;
  }

  async closeSession(
    user: AuthUser,
    sessionId: string,
    incomingTraceId?: string,
  ): Promise<AiChatClosedResponse> {
    const routeConfig = this.resolveRouteConfig();
    const normalizedSessionId = sessionId.trim();
    const traceId = this.resolveTraceId(incomingTraceId, normalizedSessionId);
    const startedAt = Date.now();
    const userHash = this.hashUserId(user.id);

    this.logAudit('log', 'api.ai_chat.session_close.requested', traceId, {
      session_id: normalizedSessionId,
      user_id_hash: userHash,
      upstream_path: routeConfig.sessionClosePath,
    });

    await this.putJson(routeConfig.sessionClosePath, traceId, {
      session_id: normalizedSessionId,
      user_id: user.id,
    });

    const recordedAt = new Date().toISOString();

    this.logAudit('log', 'api.ai_chat.session_close.completed', traceId, {
      session_id: normalizedSessionId,
      user_id_hash: userHash,
      latency_ms: Date.now() - startedAt,
      upstream_path: routeConfig.sessionClosePath,
    });

    return {
      sessionId: normalizedSessionId,
      traceId,
      recordedAt,
      status: 'closed',
    };
  }

  private async postJson(
    path: string,
    traceId: string,
    payload: Record<string, unknown>,
  ): Promise<AiServiceEnvelope | undefined> {
    const response = await this.requestJson('POST', path, traceId, payload);
    return response.body;
  }

  private async putJson(
    path: string,
    traceId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.requestJson('PUT', path, traceId, payload);
  }

  private async getJson(
    path: string,
    traceId: string,
  ): Promise<AiServiceHistoryEnvelope | undefined> {
    const timeoutMs = this.resolveTimeoutMs();

    try {
      const response = await fetch(`${this.resolveAiBaseUrl()}${path}`, {
        method: 'GET',
        headers: this.buildAiHeaders(traceId, false),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const rawText = await response.text();
      const body = this.parseBody(rawText) as AiServiceHistoryEnvelope | undefined;

      if (!response.ok) {
        throw new BadGatewayException({
          message:
            this.extractErrorMessage(body as AiServiceEnvelope | undefined, rawText) ||
            `AI service returned ${response.status}`,
          traceId,
        });
      }

      return body;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        this.logAudit('error', 'api.ai_chat.upstream.failed', traceId, {
          error_type: error.name,
          error_message: this.serializeException(error),
        });
        throw error;
      }

      if (this.isTimeoutError(error)) {
        this.logAudit('error', 'api.ai_chat.upstream.timeout', traceId, {
          timeout_ms: timeoutMs,
          error_type: error instanceof Error ? error.name : 'TimeoutError',
        });
        throw new GatewayTimeoutException({
          message: 'AI service timed out',
          traceId,
        });
      }

      this.logAudit('error', 'api.ai_chat.upstream.failed', traceId, {
        error_type: error instanceof Error ? error.name : 'UnknownError',
        error_message: this.serializeException(error),
      });

      throw new BadGatewayException({
        message: 'AI service is unavailable right now',
        traceId,
      });
    }
  }

  private async requestJson(
    method: 'POST' | 'PUT',
    path: string,
    traceId: string,
    payload: Record<string, unknown>,
  ): Promise<{ body?: AiServiceEnvelope; rawText: string }> {
    const timeoutMs = this.resolveTimeoutMs();

    try {
      const response = await fetch(`${this.resolveAiBaseUrl()}${path}`, {
        method,
        headers: this.buildAiHeaders(traceId),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const rawText = await response.text();
      const body = this.parseBody(rawText);

      if (!response.ok) {
        throw new BadGatewayException({
          message:
            this.extractErrorMessage(body, rawText) ||
            `AI service returned ${response.status}`,
          traceId,
        });
      }

      return { body, rawText };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        this.logAudit('error', 'api.ai_chat.upstream.failed', traceId, {
          error_type: error.name,
          error_message: this.serializeException(error),
        });
        throw error;
      }

      if (this.isTimeoutError(error)) {
        this.logAudit('error', 'api.ai_chat.upstream.timeout', traceId, {
          timeout_ms: timeoutMs,
          error_type: error instanceof Error ? error.name : 'TimeoutError',
        });
        throw new GatewayTimeoutException({
          message: 'AI service timed out',
          traceId,
        });
      }

      this.logAudit('error', 'api.ai_chat.upstream.failed', traceId, {
        error_type: error instanceof Error ? error.name : 'UnknownError',
        error_message: this.serializeException(error),
      });

      throw new BadGatewayException({
        message: 'AI service is unavailable right now',
        traceId,
      });
    }
  }

  private normalizeSuccessResponse(
    response: AiServiceEnvelope | undefined,
    sessionId: string,
    traceId: string,
  ): AiChatGatewayResponse {
    if (
      response?.status !== 'success' ||
      !response.data ||
      typeof response.data.reply !== 'string'
    ) {
      throw new BadGatewayException({
        message: 'AI service returned an unexpected response',
        traceId,
      });
    }

    return {
      sessionId,
      reply: response.data.reply,
      traceId,
      recordedAt: new Date().toISOString(),
      tokenUsage: this.normalizeTokenUsage(response.data.tokens),
    };
  }

  private normalizeTokenUsage(items?: AiServiceTokenItem[]) {
    const normalizedItems = (items ?? []).map((item) => ({
      provider: item.provider || 'unknown',
      input: Number(item.in ?? 0),
      output: Number(item.out ?? 0),
    }));

    return {
      items: normalizedItems,
      totalInput: normalizedItems.reduce(
        (total, item) => total + item.input,
        0,
      ),
      totalOutput: normalizedItems.reduce(
        (total, item) => total + item.output,
        0,
      ),
    };
  }

  private normalizeHistoryResponse(
    response: AiServiceHistoryEnvelope | undefined,
    traceId: string,
  ): AiChatHistoryResponse {
    if (response?.status !== 'success' || !response.data) {
      throw new BadGatewayException({
        message: 'AI service returned an unexpected history response',
        traceId,
      });
    }

    const items = (response.data.items ?? []).map((item, index) => {
      if (
        typeof item.id !== 'string' ||
        (item.role !== 'user' && item.role !== 'assistant' && item.role !== 'system') ||
        typeof item.content !== 'string' ||
        typeof item.recorded_at !== 'string'
      ) {
        throw new BadGatewayException({
          message: `AI service returned an invalid history item at index ${index}`,
          traceId,
        });
      }

      return {
        id: item.id,
        role: item.role as 'user' | 'assistant' | 'system',
        content: item.content,
        recordedAt: item.recorded_at,
        sessionId: typeof item.session_id === 'string' ? item.session_id : null,
        boundaryType:
          typeof item.boundary_type === 'string' ? item.boundary_type : null,
      };
    });

    return {
      items,
      nextCursor:
        typeof response.data.next_cursor === 'string'
          ? response.data.next_cursor
          : null,
      activeSessionId:
        typeof response.data.active_session_id === 'string'
          ? response.data.active_session_id
          : null,
      traceId,
      recordedAt: new Date().toISOString(),
    };
  }

  private normalizeSystemEntryResponse(
    response: AiServiceEnvelope | undefined,
    traceId: string,
  ): AiChatHistoryItem {
    const item = (response as AiServiceSystemEntryEnvelope | undefined)?.data;

    if (
      (response as AiServiceSystemEntryEnvelope | undefined)?.status !== 'success' ||
      !item ||
      typeof item.id !== 'string' ||
      item.role !== 'system' ||
      typeof item.content !== 'string' ||
      typeof item.recorded_at !== 'string'
    ) {
      throw new BadGatewayException({
        message: 'AI service returned an unexpected system timeline response',
        traceId,
      });
    }

    return {
      id: item.id,
      role: 'system',
      content: item.content,
      recordedAt: item.recorded_at,
      sessionId: typeof item.session_id === 'string' ? item.session_id : null,
      boundaryType: typeof item.boundary_type === 'string' ? item.boundary_type : null,
    };
  }

  private parseBody(rawText: string): AiServiceEnvelope | undefined {
    if (!rawText.trim()) {
      return undefined;
    }

    try {
      return JSON.parse(rawText) as AiServiceEnvelope;
    } catch {
      return undefined;
    }
  }

  private extractErrorMessage(
    body: AiServiceEnvelope | undefined,
    rawText: string,
  ): string | undefined {
    if (typeof body?.message === 'string' && body.message.trim()) {
      return body.message.trim();
    }

    if (rawText.trim()) {
      return rawText.trim().slice(0, 300);
    }

    return undefined;
  }

  private resolveAiBaseUrl(): string {
    return (
      this.configService.get<string>('AI_SERVICE_BASE_URL')?.trim() ||
      'http://localhost:8000'
    ).replace(/\/+$/, '');
  }

  private buildAiHeaders(traceId: string, withJsonContentType = true) {
    const headers: Record<string, string> = {
      'X-Trace-Id': traceId,
    };

    if (withJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }

    const gatewaySecret = this.resolveGatewaySharedSecret();
    if (gatewaySecret) {
      headers[AI_GATEWAY_HEADER_NAME] = gatewaySecret;
    }

    return headers;
  }

  private resolveRouteConfig(): AiServiceRouteConfig {
    return {
      healthPath: this.resolveRoutePath('AI_SERVICE_HEALTH_PATH', '/health'),
      sessionStartPath: this.resolveRoutePath(
        'AI_SERVICE_SESSION_START_PATH',
        '/api/v2/session/start',
      ),
      messagePath: this.resolveRoutePath(
        'AI_SERVICE_MESSAGE_PATH',
        '/api/v2/chat',
      ),
      sessionClosePath: this.resolveRoutePath(
        'AI_SERVICE_SESSION_CLOSE_PATH',
        '/api/v2/session/close',
      ),
      historyPath: this.resolveRoutePath(
        'AI_SERVICE_HISTORY_PATH',
        '/api/v2/history',
      ),
      systemTimelinePath: this.resolveRoutePath(
        'AI_SERVICE_SYSTEM_TIMELINE_PATH',
        '/api/v2/timeline/system',
      ),
    };
  }

  private normalizeHistoryLimit(rawValue?: string): number {
    const parsed = Number.parseInt(rawValue?.trim() || '40', 10);

    if (Number.isNaN(parsed)) {
      return 40;
    }

    return Math.min(Math.max(parsed, 1), 100);
  }

  private resolveRoutePath(configKey: string, fallback: string): string {
    const configuredValue =
      this.configService.get<string>(configKey)?.trim() || fallback;

    if (configuredValue.startsWith('/')) {
      return configuredValue;
    }

    return `/${configuredValue}`;
  }

  private resolveGatewaySharedSecret(): string {
    return this.configService.get<string>('AI_GATEWAY_SHARED_SECRET')?.trim() || '';
  }

  private resolveTimeoutMs(): number {
    const timeout = Number(
      this.configService.get<string>('AI_SERVICE_TIMEOUT_MS') ?? 30000,
    );

    if (!Number.isFinite(timeout) || timeout <= 0) {
      return 30000;
    }

    return timeout;
  }

  private resolveTraceId(
    traceId: string | undefined,
    sessionId: string,
  ): string {
    const sanitizedTraceId = traceId?.trim();
    if (sanitizedTraceId) {
      return sanitizedTraceId.slice(0, 128);
    }
    return `ai-chat:${sessionId}:${randomUUID()}`;
  }

  private hashUserId(userId: string): string {
    return createHash('sha256').update(userId).digest('hex').slice(0, 12);
  }

  private logAudit(
    level: 'log' | 'error',
    event: string,
    traceId: string,
    fields: Record<string, unknown>,
  ) {
    const payload = {
      timestamp: new Date().toISOString(),
      component: 'lifelinesproject-api.ai_chat',
      event,
      trace_id: traceId,
      ...fields,
    };

    this.logger[level](JSON.stringify(payload));
  }

  private isTimeoutError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    );
  }

  private serializeException(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
