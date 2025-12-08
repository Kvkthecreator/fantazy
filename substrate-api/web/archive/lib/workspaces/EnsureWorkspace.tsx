"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/clients";
import type { Database } from "@/lib/dbTypes";

export default function EnsureWorkspace() {
  const supabase = createBrowserClient();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setStatus("loading");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage("❌ No authenticated user found.");
        setStatus("done");
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("workspace_memberships")
        .select("workspace_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (membershipError) {
        console.error("🔴 Failed to check membership:", membershipError);
        setMessage("❌ Failed to check workspace membership.");
        setStatus("done");
        return;
      }

      if (membership?.workspace_id) {
        setMessage(`✅ Workspace already exists: ${membership.workspace_id}`);
        setStatus("done");
        return;
      }

      const { data: newWorkspace, error: wsError } = await supabase
        .from("workspaces")
        .insert({
          owner_id: user.id,
          name: `${user.email}'s Workspace`,
        })
        .select("id")
        .single();

      if (wsError || !newWorkspace) {
        console.error("❌ Failed to create workspace:", {
          user_id: user.id,
          email: user.email,
          wsError,
        });
        setMessage(`❌ Workspace creation failed: ${wsError?.message}`);
        setStatus("done");
        return;
      }

      const { error: memError } = await supabase
        .from("workspace_memberships")
        .insert({
          user_id: user.id,
          workspace_id: newWorkspace.id,
          role: "owner",
        });

      if (memError) {
        console.error("⚠️ Membership insert failed:", memError);
        setMessage(`⚠️ Created workspace but failed membership: ${memError.message}`);
      } else {
        setMessage(`✅ Workspace + membership created: ${newWorkspace.id}`);
      }

      setStatus("done");
    };

    init();
  }, []);

  return (
    <div className="text-sm text-muted-foreground border rounded-md px-4 py-3">
      <p><strong>Workspace check status:</strong></p>
      {status === "loading" ? (
        <p>Checking workspace...</p>
      ) : (
        <p>{message}</p>
      )}
    </div>
  );
}
