const mysql = require('mysql2/promise');

async function createTables() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: '',
    database: 'saas_pop_db',
    multipleStatements: true
  });

  console.log('Connected to MySQL on port 3307 to create support tables.');

  const sql = `
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_number VARCHAR(30) NOT NULL UNIQUE,
      company_id INT NOT NULL,
      company_name VARCHAR(200) NOT NULL,
      project_name VARCHAR(100) DEFAULT NULL,
      user_id INT NOT NULL,
      subject VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      priority ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Low',
      description TEXT NOT NULL,
      status ENUM('Open', 'Assigned', 'In Progress', 'Waiting For Client', 'Resolved', 'Closed') NOT NULL DEFAULT 'Open',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ticket_number (ticket_number),
      INDEX idx_company_id (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS ticket_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      sender_type ENUM('client', 'admin') NOT NULL,
      sender_id INT NOT NULL,
      message TEXT NOT NULL,
      attachment VARCHAR(255),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  try {
    await connection.query(sql);
    console.log('✅ Support tickets and ticket messages tables created successfully in saas_pop_db!');
  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    await connection.end();
  }
}

createTables();
