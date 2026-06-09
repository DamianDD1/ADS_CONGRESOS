-- ============================================================
--  🌴 Riviera Maya — Migración v5 (aditiva, sin DROP)
--  Bandeja de mensajes de contacto del sitio público.
--  Los mensajes que envían los visitantes desde el formulario de
--  "Contacto" de la landing se guardan aquí. Solo el COORDINADOR
--  puede leerlos (se filtra por rol en el backend).
--
--  Uso:  mysql -u root -p riviera_congresos < database/migracion_v5.sql
-- ============================================================
USE riviera_congresos;

CREATE TABLE IF NOT EXISTS mensajes_contacto (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(80)  NOT NULL,
  apellido    VARCHAR(120) NULL,
  email       VARCHAR(150) NOT NULL,        -- validado: debe contener '@'
  telefono    VARCHAR(25)  NULL,            -- validado: solo dígitos
  mensaje     TEXT         NOT NULL,
  leido       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
