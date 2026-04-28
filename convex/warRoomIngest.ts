import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import {
  getCorsHeaders,
  validateIngestAuth,
  unauthorizedResponse,
  checkBodySize,
  payloadTooLargeResponse,
  rateLimitResponse,
  validationErrorResponse,
} from "./ingestAuth";
import { ingestRateLimiter } from "./ingestRateLimit";
import { validatePayload, type FieldSchema } from "./lib/validation";

// ── Schema definitions per endpoint ──────────────────────────────────────

const warRoomSchema: Record<string, FieldSchema> = {
  type: { type: "string", required: true },
  roomId: { type: "string", required: false },
  name: { type: "string", required: false },
  status: { type: "string", required: false },
  participantIds: { type: "array", required: false },
  createdAt: { type: "number", required: false },
  updatedAt: { type: "number", required: false },
  speakerId: { type: "string", required: false },
  speakerName: { type: "string", required: false },
  text: { type: "string", required: false },
  payload: { type: "object", required: false },
  timestamp: { type: "number", required: false },
};

const meetingBotSchema: Record<string, FieldSchema> = {
  type: { type: "string", required: true },
  callId: { type: "string", required: false },
  botSessionId: { type: "string", required: false },
  sessionId: { type: "string", required: false },
  recallBotId: { type: "string", required: false },
  agentProfileId: { type: "string", required: false },
  meetingUrl: { type: "string", required: false },
  status: { type: "string", required: false },
  platform: { type: "string", required: false },
  durationMs: { type: "number", required: false },
  participantCount: { type: "number", required: false },
  costUsd: { type: "number", required: false },
  startedAt: { type: "number", required: false },
  endedAt: { type: "number", required: false },
  wordCount: { type: "number", required: false },
  summaryText: { type: "string", required: false },
  createdAt: { type: "number", required: false },
  updatedAt: { type: "number", required: false },
};

const transcriptSchema: Record<string, FieldSchema> = {
  type: { type: "string", required: true },
  text: { type: "string", required: true },
  roomId: { type: "string", required: false },
  callId: { type: "string", required: false },
  speakerId: { type: "string", required: false },
  speakerName: { type: "string", required: false },
  timestamp: { type: "number", required: false },
};

const missionControlSchema: Record<string, FieldSchema> = {
  type: { type: "string", required: true },
  taskId: { type: "string", required: true },
  title: { type: "string", required: false },
  description: { type: "string", required: false },
  priority: { type: "string", required: false },
  column: { type: "string", required: false },
  agentId: { type: "string", required: false },
  agentName: { type: "string", required: false },
  source: { type: "string", required: false },
  progress: { type: "number", required: false },
  dueAt: { type: "number", required: false },
  createdAt: { type: "number", required: false },
};

// ── Shared pipeline preamble ─────────────────────────────────────────────

async function pipeline(
  ctx: any,
  request: Request,
): Promise<{ headers: Record<string, string>; apiKey: string } | Response> {
  const origin = request.headers.get("Origin");
  const headers = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (!validateIngestAuth(request)) {
    return unauthorizedResponse(headers);
  }

  if (!checkBodySize(request)) {
    return payloadTooLargeResponse(headers);
  }

  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "anonymous";
  const rateCheck = await ingestRateLimiter.limit(ctx, "general", { key: apiKey });
  if (!rateCheck.ok) {
    return rateLimitResponse(headers, rateCheck.retryAfter);
  }

  return { headers, apiKey };
}

// ── Endpoint handlers ────────────────────────────────────────────────────

/**
 * POST /war-room-ingest
 * Dispatches by `type`: "room.created", "room.updated", "participant.joined", "participant.left"
 */
export const warRoomIngest = httpAction(async (ctx, request) => {
  const result = await pipeline(ctx, request);
  if (result instanceof Response) return result;
  const { headers } = result;

  try {
    const body = await request.json() as Record<string, unknown>;

    // D-09/D-11: Strict schema validation
    const errors = validatePayload(body, warRoomSchema);
    if (errors.length > 0) return validationErrorResponse(errors, headers);

    const eventType = body.type as string;

    if (eventType === "room.created" || eventType === "room.updated") {
      await ctx.runMutation(api.v6Mutations.upsertWarRoom, {
        roomId: body.roomId as string,
        name: body.name as string,
        status: body.status as string,
        participantIds: body.participantIds as string[] | undefined,
        createdAt: (body.createdAt as number) ?? Date.now(),
        updatedAt: (body.updatedAt as number) ?? Date.now(),
      });
    } else if (eventType === "participant.joined" || eventType === "participant.left") {
      await ctx.runMutation(api.v6Mutations.insertWarRoomEvent, {
        roomId: body.roomId as string,
        eventType,
        speakerId: body.speakerId as string | undefined,
        speakerName: body.speakerName as string | undefined,
        text: body.text as string | undefined,
        payload: body.payload as unknown,
        timestamp: (body.timestamp as number) ?? Date.now(),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }
});

/**
 * POST /meeting-bot-ingest
 * Dispatches by `type`: "call.started", "call.ended", "bot.status"
 */
export const meetingBotIngest = httpAction(async (ctx, request) => {
  const result = await pipeline(ctx, request);
  if (result instanceof Response) return result;
  const { headers } = result;

  try {
    const body = await request.json() as Record<string, unknown>;

    // D-09/D-11: Strict schema validation
    const errors = validatePayload(body, meetingBotSchema);
    if (errors.length > 0) return validationErrorResponse(errors, headers);

    const eventType = body.type as string;

    if (eventType === "call.started" || eventType === "call.ended") {
      await ctx.runMutation(api.v6Mutations.upsertVoiceCall, {
        callId: body.callId as string,
        botSessionId: body.botSessionId as string | undefined,
        status: body.status as string,
        platform: body.platform as string | undefined,
        agentProfileId: body.agentProfileId as string | undefined,
        durationMs: body.durationMs as number | undefined,
        participantCount: body.participantCount as number | undefined,
        costUsd: body.costUsd as number | undefined,
        startedAt: (body.startedAt as number) ?? Date.now(),
        endedAt: body.endedAt as number | undefined,
      });
    } else if (eventType === "bot.status") {
      await ctx.runMutation(api.v6Mutations.upsertMeetingBotSession, {
        sessionId: body.sessionId as string,
        callId: body.callId as string | undefined,
        recallBotId: body.recallBotId as string | undefined,
        agentProfileId: body.agentProfileId as string | undefined,
        meetingUrl: body.meetingUrl as string | undefined,
        status: body.status as string,
        wordCount: body.wordCount as number | undefined,
        summaryText: body.summaryText as string | undefined,
        createdAt: (body.createdAt as number) ?? Date.now(),
        updatedAt: (body.updatedAt as number) ?? Date.now(),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }
});

/**
 * POST /transcript-ingest
 * Dispatches by `type`: "transcript.chunk"
 * Inserts into warRoomEvents (if roomId present) AND callTranscripts (if callId present).
 */
export const transcriptIngest = httpAction(async (ctx, request) => {
  const result = await pipeline(ctx, request);
  if (result instanceof Response) return result;
  const { headers } = result;

  try {
    const body = await request.json() as Record<string, unknown>;

    // D-09/D-11: Strict schema validation
    const errors = validatePayload(body, transcriptSchema);
    if (errors.length > 0) return validationErrorResponse(errors, headers);

    const timestamp = (body.timestamp as number) ?? Date.now();

    // Insert into warRoomEvents if roomId present
    if (body.roomId) {
      await ctx.runMutation(api.v6Mutations.insertWarRoomEvent, {
        roomId: body.roomId as string,
        eventType: "transcript.chunk",
        speakerId: body.speakerId as string | undefined,
        speakerName: body.speakerName as string | undefined,
        text: body.text as string,
        timestamp,
      });
    }

    // Insert into callTranscripts if callId present
    if (body.callId) {
      await ctx.runMutation(api.v6Mutations.insertCallTranscript, {
        callId: body.callId as string,
        speakerId: body.speakerId as string | undefined,
        speakerName: body.speakerName as string | undefined,
        text: body.text as string,
        timestamp,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }
});

/**
 * POST /mission-control-ingest
 * Dispatches by `type`: "task.created", "task.updated"
 */
export const missionControlIngest = httpAction(async (ctx, request) => {
  const result = await pipeline(ctx, request);
  if (result instanceof Response) return result;
  const { headers } = result;

  try {
    const body = await request.json() as Record<string, unknown>;

    // D-09/D-11: Strict schema validation
    const errors = validatePayload(body, missionControlSchema);
    if (errors.length > 0) return validationErrorResponse(errors, headers);

    const eventType = body.type as string;

    if (eventType === "task.created") {
      await ctx.runMutation(api.v6Mutations.insertMissionControlTask, {
        taskId: body.taskId as string,
        title: body.title as string,
        description: body.description as string | undefined,
        priority: (body.priority as string) ?? "normal",
        column: (body.column as string) ?? "backlog",
        agentId: body.agentId as string,
        agentName: body.agentName as string,
        source: body.source as string | undefined,
        progress: body.progress as number | undefined,
        dueAt: body.dueAt as number | undefined,
        createdAt: (body.createdAt as number) ?? Date.now(),
      });
    } else if (eventType === "task.updated") {
      await ctx.runMutation(api.v6Mutations.updateMissionControlTask, {
        taskId: body.taskId as string,
        agentId: body.agentId as string | undefined,
        agentName: body.agentName as string | undefined,
        column: body.column as string | undefined,
        priority: body.priority as string | undefined,
        progress: body.progress as number | undefined,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }
});
