"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const CHANNEL_NAME = "retro-board";

/**
 * Real-time sync for the Retro Board via Supabase Broadcast.
 * All four columns share a single channel. Each event carries a `phase`
 * so listeners can filter for their own column.
 *
 * Event types: "add", "remove", "edit"
 */
export function useRetroBoardChannel() {
  const [event, setEvent] = useState(null);
  const channelRef = useRef(null);

  const broadcast = useCallback((type, payload) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "board_update",
      payload: { ...payload, type, ts: Date.now() },
    });
  }, []);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "board_update" }, ({ payload }) => {
      setEvent(payload);
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

  return { event, broadcast };
}
