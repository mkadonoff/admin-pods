import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

async function check() {
  const config: sql.config = {
    server: process.env.EAUTOMATE_SERVER!,
    database: process.env.EAUTOMATE_DATABASE!,
    authentication: {
      type: 'ntlm',
      options: {
        domain: process.env.EAUTOMATE_DOMAIN!,
        userName: process.env.EAUTOMATE_USER!,
        password: process.env.EAUTOMATE_PASSWORD!,
      },
    },
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };

  console.log('Connecting to:', config.server, '/', config.database);
  await sql.connect(config);

  // Check entity counts from the actual tables used by sync
  console.log('\nEntity counts (Active = 1):');
  
  const queries = [
    { name: 'Users (CoUsers)', sql: 'SELECT COUNT(*) as count FROM dbo.CoUsers WHERE Active = 1' },
    { name: 'Customers (ARCustomers)', sql: 'SELECT COUNT(*) as count FROM dbo.ARCustomers WHERE Active = 1' },
    { name: 'Equipment (SCEquipments)', sql: 'SELECT COUNT(*) as count FROM dbo.SCEquipments WHERE Active = 1' },
    { name: 'Contacts (CMContacts)', sql: 'SELECT COUNT(*) as count FROM dbo.CMContacts WHERE Active = 1' },
  ];

  for (const q of queries) {
    try {
      const result = await sql.query(q.sql);
      console.log(`  ${q.name}: ${result.recordset[0].count}`);
    } catch (err: any) {
      console.log(`  ${q.name}: ERROR - ${err.message}`);
    }
  }

  await (await sql.connect(config)).close();
  console.log('\nDone.');
}

check().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
