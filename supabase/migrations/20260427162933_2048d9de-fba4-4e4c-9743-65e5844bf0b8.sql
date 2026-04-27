REVOKE EXECUTE ON FUNCTION public.complete_education_module(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.uncomplete_education_module(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_education_module(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.uncomplete_education_module(TEXT) TO authenticated;