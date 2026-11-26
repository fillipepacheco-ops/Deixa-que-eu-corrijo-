-- Modo game: até 8 minutos (480 s) por questão. Pode rodar mais de uma vez.
alter table game_questions drop constraint if exists game_questions_time_limit_check;
alter table game_questions add constraint game_questions_time_limit_check check (time_limit between 5 and 480);
