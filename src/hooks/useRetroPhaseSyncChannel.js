"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const CHANNEL_NAME = "retro-phase-sync";

/**
 * Real-time phase sync via Supabase Broadcast.
 *
 * The facilitator broadcasts phase transitions, session finish events,
 * and timer state. All other admins and employees receive them and stay
 * in sync without polling. Late joiners request current timer state on subscribe.
 */
export function useRetroPhaseSyncChannel() {
  const [phaseEvent, setPhaseEvent] = useState(null);
  const [finishEvent, setFinishEvent] = useState(null);
  const [actionEvent, setActionEvent] = useState(null);
  const [timerEvent, setTimerEvent] = useState(null);
  const [timerRequestEvent, setTimerRequestEvent] = useState(null);
  const channelRef = useRef(null);

  const broadcastPhase = useCallback((payload) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "phase_change",
      payload: { ...payload, ts: Date.now() },
    });
  }, []);

  const broadcastFinish = useCallback((payload) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "session_finish",
      payload: { ...payload, ts: Date.now() },
    });
  }, []);

  const broadcastStart = useCallback((payload) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "session_start",
      payload: { ...payload, ts: Date.now() },
    });
  }, []);

  const broadcastAction = useCallback((payload) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "in_phase_action",
      payload: { ...payload, ts: Date.now() },
    });
  }, []);

  const broadcastTimer = useCallback((payload) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "timer_sync",
      payload: { ...payload, ts: Date.now() },
    });
  }, []);

  const requestTimer = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "timer_request",
      payload: { ts: Date.now() },
    });
  }, []);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "phase_change" }, ({ payload }) => {
      setPhaseEvent(payload);
    });

    channel.on("broadcast", { event: "session_finish" }, ({ payload }) => {
      setFinishEvent(payload);
    });

    channel.on("broadcast", { event: "session_start" }, ({ payload }) => {
      setPhaseEvent({ ...payload, phase: 0 });
    });

    channel.on("broadcast", { event: "in_phase_action" }, ({ payload }) => {
      setActionEvent(payload);
    });

    channel.on("broadcast", { event: "timer_sync" }, ({ payload }) => {
      setTimerEvent(payload);
    });

    channel.on("broadcast", { event: "timer_request" }, ({ payload }) => {
      setTimerRequestEvent(payload);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channelRef.current = channel;
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  return {
    phaseEvent, finishEvent, actionEvent, timerEvent, timerRequestEvent,
    broadcastPhase, broadcastFinish, broadcastStart, broadcastAction,
    broadcastTimer, requestTimer,
  };
}
