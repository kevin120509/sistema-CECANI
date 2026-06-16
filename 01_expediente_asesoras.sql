CREATE TABLE public.expediente_asesoras (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL,
  asesora_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT expediente_asesoras_pkey PRIMARY KEY (id),
  CONSTRAINT ea_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id) ON DELETE CASCADE,
  CONSTRAINT ea_asesora_id_fkey FOREIGN KEY (asesora_id) REFERENCES public.perfiles(id) ON DELETE CASCADE,
  UNIQUE(expediente_id, asesora_id)
);

-- Habilitar RLS (si lo están usando, aunque por la Clean Architecture a veces se bypasses)
ALTER TABLE public.expediente_asesoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.expediente_asesoras FOR ALL USING (true);

-- Migrar las asignaciones existentes
INSERT INTO public.expediente_asesoras (expediente_id, asesora_id)
SELECT id, asesora_id
FROM public.expedientes
WHERE asesora_id IS NOT NULL;
