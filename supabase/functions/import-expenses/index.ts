import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://deno.land/std@0.224.0/csv/mod.ts";

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

    const { csvUrl, clearExisting } = await req.json();

    // Fetch CSV
    const csvResp = await fetch(csvUrl);
    if (!csvResp.ok) throw new Error(`Failed to fetch CSV: ${csvResp.status}`);
    const csvText = await csvResp.text();

    // Parse CSV
    const rows = parse(csvText, { skipFirstRow: true, columns: [
      "date", "company", "siteName", "user", "headcount", "category", "merchant", "amount"
    ]});

    // Load sites for name matching
    const { data: sites } = await supabase.from("sites").select("id, name");
    const siteMap = new Map<string, string>();
    for (const s of sites || []) {
      siteMap.set(s.name.trim(), s.id);
    }

    const fuzzyMatch = (name: string): string => {
      const trimmed = name.trim();
      if (siteMap.has(trimmed)) return siteMap.get(trimmed)!;
      for (const [siteName, siteId] of siteMap) {
        if (siteName.includes(trimmed) || trimmed.includes(siteName)) return siteId;
      }
      return "";
    };

    // Clear existing transactions if requested
    if (clearExisting) {
      await supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    // Load existing transactions for dedup (when not clearing)
    const existingKeys = new Set<string>();
    if (!clearExisting) {
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data: existing } = await supabase
          .from("transactions")
          .select("date, description, amount")
          .range(from, from + PAGE - 1);
        if (!existing || existing.length === 0) break;
        for (const e of existing) {
          existingKeys.add(`${e.date}|${e.description}|${e.amount}`);
        }
        if (existing.length < PAGE) break;
        from += PAGE;
      }
    }

    // Process rows
    const transactions: Array<{
      date: string;
      site_id: string;
      category: string;
      description: string;
      amount: number;
    }> = [];

    let matched = 0;
    let unmatched = 0;
    let skipped = 0;
    const unmatchedSites = new Set<string>();
    const seenKeys = new Set<string>();

    for (const row of rows) {
      const rawDate = String(row.date || "").trim();
      const date = rawDate.slice(0, 10);
      if (!date || date.length < 10) continue;

      const amount = parseInt(String(row.amount || "0").replace(/,/g, "")) || 0;
      if (amount <= 0) continue;

      const siteName = String(row.siteName || "").trim();
      const category = String(row.category || "기타").trim();
      const merchant = String(row.merchant || "").trim();
      const user = String(row.user || "").trim();
      const description = merchant + (user ? ` (${user})` : "");

      // Dedup: skip if same date+description+amount already exists
      const key = `${date}|${description}|${amount}`;
      if (seenKeys.has(key) || existingKeys.has(key)) {
        skipped++;
        continue;
      }
      seenKeys.add(key);

      let siteId = "";
      if (siteName && siteName !== "기타") {
        siteId = fuzzyMatch(siteName);
        if (siteId) {
          matched++;
        } else {
          unmatched++;
          unmatchedSites.add(siteName);
        }
      }

      transactions.push({ date, site_id: siteId, category, description, amount });
    }

    // Insert in batches of 500
    let inserted = 0;
    for (let i = 0; i < transactions.length; i += 500) {
      const batch = transactions.slice(i, i + 500);
      const { error } = await supabase.from("transactions").insert(batch);
      if (error) {
        console.error(`Batch ${i} error:`, error);
        throw new Error(`Insert error at batch ${i}: ${error.message}`);
      }
      inserted += batch.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: transactions.length,
        inserted,
        matched,
        unmatched,
        skipped,
        unmatchedSites: [...unmatchedSites],
      }),
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
