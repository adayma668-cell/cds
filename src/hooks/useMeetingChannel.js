"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const CHANNEL_NAME = "standup-meeting";

/**
 * Real-time meeting sync via Supabase Broadcast.
 * Scrum Master broadcasts state; employees listen.
 * Late-joiners request current state on subscribe.
 *
 * @param {"scrum_master"|"employee"} role
 */
export function useMeetingChannel(role = "employee") {
  const [meetingState, setMeetingState] = useState(null);
  const channelRef = useRef(null);
  const localStateRef = useRef(null);

  const broadcastState = useCallback((state) => {
    localStateRef.current = state;
    setMeetingState(state);
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "meeting_update",
        payload: state,
      });
    }
  }, []);

  useEffect(() => {
    let heartbeatInterval = null;

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "meeting_update" }, ({ payload }) => {
      setMeetingState(payload);
    });

    if (role === "scrum_master") {
      channel.on("broadcast", { event: "request_state" }, () => {
        if (localStateRef.current && channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "meeting_update",
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
        if (role === "scrum_master") {
          heartbeatInterval = setInterval(() => {
            if (localStateRef.current && channelRef.current) {
              channelRef.current.send({
                type: "broadcast",
                event: "meeting_update",
                payload: localStateRef.current,
              });
            }
          }, 5000);
        }
      }
    });

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [role]);

  return { meetingState, broadcastState };
}
