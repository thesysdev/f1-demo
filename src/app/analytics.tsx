"use client";

import { useEffect } from "react";

// Only the deployed demo, served under openui.com/demo, reports to OpenUI's PostHog project.
const isDeployedDemo = (hostname: string) => /(^|\.)openui\.com$/.test(hostname);

export function Analytics() {
  useEffect(() => {
    if (!isDeployedDemo(window.location.hostname)) return;

    void import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init("phc_3OLW53x09ZTVZSV6BEpj5uycj3ooqR6KOemOjx04e3D", {
          api_host: "https://dgoeivjus9jfp.cloudfront.net",
          capture_pageview: "history_change",
          disable_session_recording: false,
          session_recording: { sampleRate: 0.3 },
          disable_surveys: true,
        });
      })
      .catch(() => {
        // Analytics must never break the demo.
      });
  }, []);

  return null;
}
