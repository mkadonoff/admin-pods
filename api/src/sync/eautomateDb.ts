/**
 * e-automate database connection client
 * Connects to CoRPGTestNew database on AS05 SQL Server using Windows Authentication
 */

import sql from 'mssql';

const config: sql.config = {
  server: process.env.EAUTOMATE_SERVER || 'AS05',
  database: process.env.EAUTOMATE_DATABASE || 'CoRPGTestNew',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  // Use Windows Authentication (NTLM)
  authentication: {
    type: 'ntlm',
    options: {
      domain: process.env.EAUTOMATE_DOMAIN || 'RPG',
      userName: process.env.EAUTOMATE_USER || '',
      password: process.env.EAUTOMATE_PASSWORD || '',
    },
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getEautomateConnection(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  pool = await sql.connect(config);
  return pool;
}

export async function closeEautomateConnection(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

// Query interfaces for e-automate tables
export interface EAUser {
  UserID: number;
  Username: string;
  Active: boolean;
}

export interface EACustomer {
  CustomerID: number;
  CustomerName: string;
  Active: boolean;
}

export interface EAEquipment {
  EquipmentID: number;
  EquipmentNumber: string;
  CustomerID: number | null;
  Active: boolean;
}

export interface EAContact {
  ContactID: number;
  PrefFullName: string;
  Active: boolean;
}

// Query functions
export async function fetchActiveUsers(): Promise<EAUser[]> {
  const pool = await getEautomateConnection();
  const result = await pool.request().query<EAUser>(`
    SELECT UserID, Username, Active
    FROM dbo.CoUsers
    WHERE Active = 1
  `);
  return result.recordset;
}

export async function fetchActiveCustomers(): Promise<EACustomer[]> {
  const pool = await getEautomateConnection();
  const result = await pool.request().query<EACustomer>(`
    SELECT CustomerID, CustomerName, Active
    FROM dbo.ARCustomers
    WHERE Active = 1
  `);
  return result.recordset;
}

export async function fetchActiveEquipment(): Promise<EAEquipment[]> {
  const pool = await getEautomateConnection();
  const result = await pool.request().query<EAEquipment>(`
    SELECT EquipmentID, EquipmentNumber, CustomerID, Active
    FROM dbo.SCEquipments
    WHERE Active = 1
  `);
  return result.recordset;
}

export async function fetchActiveContacts(): Promise<EAContact[]> {
  const pool = await getEautomateConnection();
  const result = await pool.request().query<EAContact>(`
    SELECT ContactID, PrefFullName, Active
    FROM dbo.CMContacts
    WHERE Active = 1
  `);
  return result.recordset;
}
