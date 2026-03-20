"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const CHANNEL_NAME = "retro-open-actions";

/**
 * Real-time sync for Previous Open Actions via Supabase Broadcast.
 * When an admin toggles an action's done state, the change is
 * broadcast to all connected clients so every screen updates live.
 * @param {boolean} [enabled=true]
 */
export function useOpenActionsChannel(enabled = true) {
  const [toggleEvent, setToggleEvent] = useState(null);
  const channelRef = useRef(null);

  const broadcastToggle = useCallback((id, done) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "action_toggle",
      payload: { id, done, ts: Date.now() },
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setToggleEvent(null);
      channelRef.current = null;
      return;
    }

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "action_toggle" }, ({ payload }) => {
      setToggleEvent(payload);
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
  }, [enabled]);

  return { toggleEvent, broadcastToggle };
}
