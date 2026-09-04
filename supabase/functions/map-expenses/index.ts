import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all unmatched transactions
    const { data: unmatched, error: fetchErr } = await supabase
      .from("transactions")
      .select("id, date, description")
      .eq("site_id", "");
    
    if (fetchErr) throw fetchErr;
    if (!unmatched || unmatched.length === 0) {
      return new Response(JSON.stringify({ success: true, updated: 0, message: "No unmatched transactions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get all workers
    const { data: workers } = await supabase.from("workers").select("id, name");
    const workerList = workers || [];

    // Get all work_logs
    const { data: workLogs } = await supabase.from("work_logs").select("date, worker_id, site_id");
    
    // Build review candidates only; never auto-write a worker/date guess.
    const dateSiteMap = new Map<string, Set<string>>();
    for (const wl of workLogs || []) {
      const key = `${wl.date}|${wl.worker_id}`;
      if (!dateSiteMap.has(key)) dateSiteMap.set(key, new Set());
      dateSiteMap.get(key)!.add(wl.site_id);
    }

    const candidates: Array<{ id: string; candidate_site_ids: string[]; classification: string }> = [];

    for (const tx of unmatched) {
      // Extract worker name from description like "merchant (workerName)"
      const match = tx.description?.match(/\(([^)]+)\)\s*$/);
      if (!match) continue;
      const workerName = match[1].trim();
      
      const worker = workerList.find(w => w.name === workerName);
      if (!worker) continue;

      const key = `${tx.date}|${worker.id}`;
      const siteIds = [...(dateSiteMap.get(key) || [])];
      if (siteIds.length) candidates.push({ id: tx.id, candidate_site_ids: siteIds, classification: siteIds.length === 1 ? 'REVIEW_REQUIRED' : 'REVIEW_REQUIRED_AMBIGUOUS' });
    }

    return new Response(
      JSON.stringify({ success: true, totalUnmatched: unmatched.length, updated: 0, candidates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
