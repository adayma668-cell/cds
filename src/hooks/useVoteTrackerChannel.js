"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const CHANNEL_NAME = "retro-vote-tracker";

/**
 * Real-time vote tracker sync via Supabase Broadcast.
 * Every time a user casts or removes a vote, they broadcast
 * their updated vote count so the admin tracker refreshes live.
 */
export function useVoteTrackerChannel() {
  const [voteEvent, setVoteEvent] = useState(null);
  const channelRef = useRef(null);

  const broadcastVoteChange = useCallback((userId, voteCount) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "vote_change",
      payload: { userId, voteCount, ts: Date.now() },
    });
  }, []);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "vote_change" }, ({ payload }) => {
      setVoteEvent(payload);
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

  return { voteEvent, broadcastVoteChange };
}
