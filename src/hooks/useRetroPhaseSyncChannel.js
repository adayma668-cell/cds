"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const CHANNEL_NAME = "retro-phase-sync";

/**
 * Real-time phase sync via Supabase Broadcast.
 *
 * The facilitator broadcasts phase transitions and session finish events.
 * All other admins and employees receive them and stay in sync without polling.
 */
export function useRetroPhaseSyncChannel() {
  const [phaseEvent, setPhaseEvent] = useState(null);
  const [finishEvent, setFinishEvent] = useState(null);
  const [actionEvent, setActionEvent] = useState(null);
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

  return { phaseEvent, finishEvent, actionEvent, broadcastPhase, broadcastFinish, broadcastStart, broadcastAction };
}
