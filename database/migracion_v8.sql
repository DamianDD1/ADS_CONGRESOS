-- ============================================================
--  🌴 Riviera Maya — Migración v8
--  Notificaciones a proveedores cuando son asignados a un congreso
--  Ejecutar: mysql -u root -p riviera_congresos < database/migracion_v8.sql
-- ============================================================
USE riviera_congresos;

CREATE TABLE IF NOT EXISTS notificaciones_proveedor (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT NOT NULL,                   -- usuario con rol proveedor
  congreso_id  INT NOT NULL,
  tipo         ENUM('asignacion','cancelacion') NOT NULL DEFAULT 'asignacion',
  mensaje      TEXT NOT NULL,
  leido        TINYINT(1) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)  ON DELETE CASCADE,
  FOREIGN KEY (congreso_id) REFERENCES congresos(id) ON DELETE CASCADE
) ENGINE=InnoDB;
