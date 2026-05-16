-- SEO audit results storage
CREATE TABLE public.seo_audit_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  performance_score INTEGER,
  accessibility_score INTEGER,
  best_practices_score INTEGER,
  seo_score INTEGER,
  rich_results_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_regression BOOLEAN NOT NULL DEFAULT false,
  regression_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_audit_results_created_at
  ON public.seo_audit_results (created_at DESC);

CREATE INDEX idx_seo_audit_results_regression
  ON public.seo_audit_results (is_regression, created_at DESC)
  WHERE is_regression = true;

ALTER TABLE public.seo_audit_results ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "Admins can view SEO audit results"
ON public.seo_audit_results
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- No client inserts/updates/deletes — edge function uses service role.
