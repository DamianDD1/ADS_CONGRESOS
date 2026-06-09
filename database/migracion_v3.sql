-- ============================================================
--  🌴 Riviera Maya — Migración v3 (aditiva, sin DROP)
--  Agrega el estado 'reembolsado' a los congresos para que el
--  coordinador pueda registrar liquidación, reembolso o cancelación.
--  Uso:  mysql -u root -p riviera_congresos < migracion_v3.sql
-- ============================================================
USE riviera_congresos;

-- Amplía el enum de estado para incluir 'reembolsado'.
-- (MODIFY es seguro de re-ejecutar: solo redefine la columna.)
ALTER TABLE congresos
  MODIFY COLUMN estado
  ENUM('borrador','planeacion','activo','cerrado','cancelado','reembolsado')
  NOT NULL DEFAULT 'planeacion';
