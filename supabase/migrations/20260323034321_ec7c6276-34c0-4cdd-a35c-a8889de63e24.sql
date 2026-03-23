ALTER TABLE public.allocation_cycles
ADD CONSTRAINT check_fiscal_year_format
CHECK (fiscal_year ~ '^\d{4}/\d{4}$');