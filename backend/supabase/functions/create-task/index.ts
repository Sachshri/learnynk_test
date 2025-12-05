import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CreateTaskPayload = {
  related_id: string;
  task_type: string;
  due_at: string;
};

// Typed as const to allow for stricter type checking 
const VALID_TYPES = ["call", "email", "review"] as const;

serve(async (req: Request) => {
  // 1. Handling CORS 
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as Partial<CreateTaskPayload>;
    const { related_id, task_type, due_at } = body;

    // STEP 1: VALIDATION 

    // Validate related_id presence
    if (!related_id) {
      return new Response(JSON.stringify({ error: "related_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate task_type
    if (!task_type || !VALID_TYPES.includes(task_type as any)) {
      return new Response(
        JSON.stringify({ error: `Invalid task_type. Must be one of: ${VALID_TYPES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate due_at (Must be a date, must be in the future)
    if (!due_at) {
      return new Response(JSON.stringify({ error: "due_at is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dueDate = new Date(due_at);
    const now = new Date();
    
    if (isNaN(dueDate.getTime())) {
      return new Response(JSON.stringify({ error: "due_at must be a valid ISO date string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (dueDate <= now) {
      return new Response(JSON.stringify({ error: "due_at must be a future date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 2: DATA INTEGRITY  
    // We must find the tenant_id associated with the application (related_id).
    // The client should not send tenant_id manually for security reasons.
    
    const { data: appData, error: appError } = await supabase
      .from("applications")
      .select("tenant_id")
      .eq("id", related_id)
      .single();

    if (appError || !appData) {
      return new Response(JSON.stringify({ error: "Application (related_id) not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 3: INSERT INTO TASKS

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        related_id: related_id,
        type: task_type,
        due_at: due_at,
        tenant_id: appData.tenant_id,
        status: "open", 
      })
      .select()
      .single();

    if (error) {
      console.error("Database Insert Error:", error);
      throw error;
    }

    // STEP 4: REALTIME BROADCAST 
    
    const channel = supabase.channel("tasks");
    
    // We subscribe, verify connection, send, then unsubscribe to be clean
    // Note: In high-throughput production, you might fire-and-forget, but this ensures delivery.
    await new Promise<void>((resolve) => {
        channel.subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
                await channel.send({
                    type: "broadcast",
                    event: "task.created",
                    payload: {
                        task_id: data.id,
                        related_id: related_id,
                        task_type: task_type,
                        due_at: due_at
                    },
                });
                supabase.removeChannel(channel);
                resolve();
            }
        });
    });

    // STEP 5: RETURN SUCCESS 

    return new Response(JSON.stringify({ success: true, task_id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Function Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});