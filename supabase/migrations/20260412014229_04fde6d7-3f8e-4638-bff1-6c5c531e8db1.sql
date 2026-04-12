CREATE TRIGGER log_status_change
  BEFORE UPDATE ON public.bursary_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.log_status_change();