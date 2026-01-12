"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getStoredAttribution, clearAttribution } from "@/lib/utils/attribution";

/**
 * Client component that saves attribution data to the database after auth
 * Should be included in authenticated layouts/pages
 */
export function AttributionSaver() {
  useEffect(() => {
    async function saveAttribution() {
      const supabase = createClient();

      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get stored attribution
      const attribution = getStoredAttribution();
      if (!attribution) return;

      // Check if attribution already saved (avoid re-saving on every page load)
      const { data: existingUser } = await supabase
        .from('users')
        .select('signup_source')
        .eq('id', user.id)
        .single();

      // Only save if not already set
      if (existingUser && existingUser.signup_source === null) {
        await supabase
          .from('users')
          .update({
            signup_source: attribution.source,
            signup_campaign: attribution.campaign,
            signup_medium: attribution.medium,
            signup_content: attribution.content,
            signup_landing_page: attribution.landingPage,
            signup_referrer: attribution.referrer,
          })
          .eq('id', user.id);

        // Clear from localStorage after successful save
        clearAttribution();
      }
    }

    saveAttribution();
  }, []);

  return null; // This component renders nothing
}
