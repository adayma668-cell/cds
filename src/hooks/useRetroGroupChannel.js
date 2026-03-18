"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const CHANNEL_NAME = "retro-group";

export function useRetroGroupChannel() {
  const [event, setEvent] = useState(null);
  const channelRef = useRef(null);

  const broadcast = useCallback((type, payload) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "group_update",
      payload: { ...payload, type, ts: Date.now() },
    });
  }, []);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "group_update" }, ({ payload }) => {
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
