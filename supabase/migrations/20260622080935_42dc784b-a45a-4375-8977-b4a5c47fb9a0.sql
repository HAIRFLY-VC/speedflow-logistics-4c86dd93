
UPDATE public.routes
SET notes = regexp_replace(regexp_replace(notes, '(\S)-\s+(\S)', '\1-\2', 'g'), '(\S)\s+-(\S)', '\1-\2', 'g')
WHERE notes ~ '\S-\s+\S' OR notes ~ '\S\s+-\S';

UPDATE public.orders
SET nome_rota = regexp_replace(regexp_replace(nome_rota, '(\S)-\s+(\S)', '\1-\2', 'g'), '(\S)\s+-(\S)', '\1-\2', 'g')
WHERE nome_rota ~ '\S-\s+\S' OR nome_rota ~ '\S\s+-\S';
