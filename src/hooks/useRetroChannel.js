"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const CHANNEL_NAME = "retro-icebreaker";

/**
 * Real-time ice breaker sync via Supabase Broadcast.
 * Admin broadcasts questions, current question, and spin triggers.
 * Employees receive and render the synced read-only view.
 *
 * @param {"admin"|"employee"} role
 * @param {boolean} [enabled=true] Subscribe only while a retro session is live (saves connections + re-renders).
 */
export function useRetroChannel(role = "employee", enabled = true) {
  const [icebreakerState, setIcebreakerState] = useState(null);
  const [spinTrigger, setSpinTrigger] = useState(null);
  const channelRef = useRef(null);
  const localStateRef = useRef(null);

  const broadcastIcebreakerState = useCallback((state) => {
    localStateRef.current = state;
    setIcebreakerState(state);
    channelRef.current?.send({
      type: "broadcast",
      event: "icebreaker_state",
      payload: state,
    });
  }, []);

  const broadcastSpin = useCallback((winnerIdx) => {
    const trigger = { winnerIdx, ts: Date.now() };
    setSpinTrigger(trigger);
    channelRef.current?.send({
      type: "broadcast",
      event: "spin_trigger",
      payload: trigger,
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIcebreakerState(null);
      setSpinTrigger(null);
      channelRef.current = null;
      return;
    }

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "icebreaker_state" }, ({ payload }) => {
      setIcebreakerState(payload);
    });

    channel.on("broadcast", { event: "spin_trigger" }, ({ payload }) => {
      setSpinTrigger(payload);
    });

    if (role === "admin") {
      channel.on("broadcast", { event: "request_state" }, () => {
        if (localStateRef.current && channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "icebreaker_state",
            payload: localStateRef.current,
          });
        }
      });
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channelRef.current = channel;
        if (role === "employee") {
          setTimeout(() => {
            channel.send({
              type: "broadcast",
              event: "request_state",
              payload: {},
            });
          }, 300);
        }
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [role, enabled]);

  return { icebreakerState, spinTrigger, broadcastIcebreakerState, broadcastSpin };
}
