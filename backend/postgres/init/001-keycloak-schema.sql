-- Uruchamiane tylko przy INICJALIZACJI pustego wolumenu Postgresa (docker-entrypoint-initdb.d).
-- Migracje EF Core każdego modułu tworzą swój schemat same (EnsureSchema), ale Liquibase
-- Keycloaka tego nie robi — bez tego jego pierwszy start pada z "schema keycloak does not exist".
CREATE SCHEMA IF NOT EXISTS keycloak;
