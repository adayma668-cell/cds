"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const CHANNEL_NAME = "retro-vote-tracker";

/**
 * Real-time vote tracker sync via Supabase Broadcast.
 *
 * Events:
 * - vote_change: user vote count update (for admin tracker)
 * - item_vote:   individual item vote delta (for syncing counts across users)
 */
export function useVoteTrackerChannel() {
  const [voteEvent, setVoteEvent] = useState(null);
  const [itemVoteEvent, setItemVoteEvent] = useState(null);
  const channelRef = useRef(null);

  const broadcastVoteChange = useCallback((userId, voteCount) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "vote_change",
      payload: { userId, voteCount, ts: Date.now() },
    });
  }, []);

  const broadcastItemVote = useCallback((itemId, delta) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "item_vote",
      payload: { itemId, delta, ts: Date.now() },
    });
  }, []);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "vote_change" }, ({ payload }) => {
      setVoteEvent(payload);
    });

    channel.on("broadcast", { event: "item_vote" }, ({ payload }) => {
      setItemVoteEvent(payload);
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

  return { voteEvent, itemVoteEvent, broadcastVoteChange, broadcastItemVote };
}
