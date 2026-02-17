
-- Sites table
CREATE TABLE public.sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  budget NUMERIC NOT NULL DEFAULT 0,
  company_name TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to sites" ON public.sites FOR ALL USING (true) WITH CHECK (true);

-- Workers table
CREATE TABLE public.workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  daily NUMERIC NOT NULL DEFAULT 150000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to workers" ON public.workers FOR ALL USING (true) WITH CHECK (true);

-- Work logs table
CREATE TABLE public.work_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  site_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  md NUMERIC NOT NULL DEFAULT 1,
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to work_logs" ON public.work_logs FOR ALL USING (true) WITH CHECK (true);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  site_id TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);

-- Checklists table
CREATE TABLE public.checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'task',
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  memo TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to checklists" ON public.checklists FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklists;

-- Storage bucket for imports
INSERT INTO storage.buckets (id, name, public) VALUES ('imports', 'imports', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read on imports" ON storage.objects FOR SELECT USING (bucket_id = 'imports');
CREATE POLICY "Allow public insert on imports" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'imports');
