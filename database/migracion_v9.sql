-- ============================================================
--  🌴 Riviera Maya — Migración v9
--  Notificaciones de postulaciones de proveedores:
--    'aprobacion'  -> el coordinador aceptó la postulación del proveedor
--    'rechazo'     -> el coordinador rechazó la postulación del proveedor
--  Ejecutar: mysql -u root -p riviera_congresos < database/migracion_v9.sql
-- ============================================================
USE riviera_congresos;

ALTER TABLE notificaciones_proveedor
  MODIFY COLUMN tipo
    ENUM('asignacion','cancelacion','aprobacion','rechazo')
    NOT NULL DEFAULT 'asignacion';
