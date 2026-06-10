import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";

/**
 * POST /war-room-ingest
 * Dispatches by `type`: "room.created", "room.updated", "participant.joined", "participant.left"
 */
export const warRoomIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    if (!body.type) {
      return new Response(
        JSON.stringify({ error: "Missing required field: type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
      );
    }

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
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
});

/**
 * POST /meeting-bot-ingest
 * Dispatches by `type`: "call.started", "call.ended", "bot.status"
 */
export const meetingBotIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    if (!body.type) {
      return new Response(
        JSON.stringify({ error: "Missing required field: type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
      );
    }

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
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
});

/**
 * POST /transcript-ingest
 * Dispatches by `type`: "transcript.chunk"
 * Inserts into warRoomEvents (if roomId present) AND callTranscripts (if callId present).
 */
export const transcriptIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    if (!body.type) {
      return new Response(
        JSON.stringify({ error: "Missing required field: type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
      );
    }

    if (!body.text) {
      return new Response(
        JSON.stringify({ error: "Missing required field: text" }),
        { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
      );
    }

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
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
});

/**
 * POST /mission-control-ingest
 * Dispatches by `type`: "task.created", "task.updated"
 */
export const missionControlIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    if (!body.type) {
      return new Response(
        JSON.stringify({ error: "Missing required field: type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
      );
    }

    if (!body.taskId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: taskId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
      );
    }

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
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
});
