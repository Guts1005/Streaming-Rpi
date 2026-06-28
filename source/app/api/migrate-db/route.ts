import { NextResponse } from 'next/server';
import { getQuery, allQuery } from '@/lib/db'; // This currently points to SQLite
import { Client } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Migration only allowed in development mode' }, { status: 403 });
  }

  const connString = (process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || '').replace('?sslmode=require', '');
  const client = new Client({
    connectionString: connString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // 1. Create Tables in Postgres
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id INTEGER DEFAULT 0,
        site_id TEXT,
        emp_id INTEGER,
        ac TEXT,
        designation TEXT,
        employee_name TEXT,
        username TEXT UNIQUE,
        pw TEXT,
        gender TEXT DEFAULT 'M',
        date_of_birth TEXT DEFAULT '0000-00-00',
        address TEXT,
        branch TEXT,
        bank_name TEXT,
        account_no TEXT,
        ifsc_code TEXT,
        pan_no TEXT,
        salary REAL DEFAULT 0.00,
        contact_01 INTEGER DEFAULT 0,
        contact_02 INTEGER DEFAULT 0,
        email_id TEXT,
        forvendorid TEXT,
        shearing TEXT DEFAULT '0',
        date_joining TEXT DEFAULT '0000-00-00',
        added_date TEXT DEFAULT '0000-00-00',
        updated_date TEXT DEFAULT '0000-00-00',
        actv TEXT DEFAULT 'y',
        User_for TEXT,
        signature TEXT,
        is_android TEXT DEFAULT 'y',
        boq_rate TEXT DEFAULT 'N',
        company_id INTEGER,
        CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES ks_companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ks_companies (
        id SERIAL PRIMARY KEY,
        cnm TEXT UNIQUE,
        company_name_on_bill TEXT,
        company_address TEXT,
        csd TEXT,
        ced TEXT,
        opening_bal TEXT,
        phone TEXT,
        phone2 TEXT,
        "SMS" TEXT,
        gst_number TEXT,
        registration_no TEXT,
        service_tax_no TEXT,
        tin_no TEXT,
        cst_no TEXT,
        emails TEXT,
        voucher_adjust_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ks_customers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER,
        cnm TEXT,
        city TEXT,
        state TEXT,
        gst_no TEXT,
        actv TEXT DEFAULT 'Y',
        tdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        udate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_customers_company FOREIGN KEY (company_id) REFERENCES ks_companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ks_sites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        company_id INTEGER,
        customer_id INTEGER,
        site_name TEXT,
        address TEXT,
        dlvry_address TEXT,
        client_mail TEXT,
        contact_person1 TEXT,
        contact_person1_mobile TEXT,
        contact_person1_mail TEXT,
        contact_person2 TEXT,
        contact_person2_mobile TEXT,
        contact_person2_mail TEXT,
        actv TEXT DEFAULT 'Y',
        boq_amount TEXT,
        pmc TEXT,
        from_date TEXT,
        end_date TEXT,
        HOD TEXT,
        fl TEXT,
        company_logo TEXT,
        PMC_logo TEXT,
        our_logo TEXT,
        graph TEXT,
        max_permissible_indents TEXT,
        boq_added TEXT,
        sft TEXT,
        purchase_sft TEXT,
        internal TEXT,
        ongoing TEXT DEFAULT 'Y',
        sft_block TEXT,
        feedback TEXT,
        tdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        udate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sites_company FOREIGN KEY (company_id) REFERENCES ks_companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_sites_customer FOREIGN KEY (customer_id) REFERENCES ks_customers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ks_devices (
        id SERIAL PRIMARY KEY,
        company_id BIGINT,
        user_id INTEGER,
        site_id INTEGER,
        device_name TEXT,
        device_id VARCHAR(100),
        mac_id VARCHAR(50),
        api_base_url TEXT,
        pairing_token TEXT UNIQUE,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ks_devices_company FOREIGN KEY (company_id) REFERENCES ks_companies(id)
      );
    `);

    // 2. Migrate Data from SQLite to Postgres
    const users = await allQuery('SELECT * FROM users');
    if (users && users.length > 0) {
      for (const u of users) {
        try {
          await client.query(`
            INSERT INTO users (user_id, site_id, emp_id, ac, designation, employee_name, username, pw, gender, date_of_birth, address, branch, bank_name, account_no, ifsc_code, pan_no, salary, contact_01, contact_02, email_id, forvendorid, shearing, date_joining, added_date, updated_date, actv, User_for, signature, is_android, boq_rate, company_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
            ON CONFLICT (username) DO NOTHING
          `, [u.user_id, u.site_id, u.emp_id, u.ac, u.designation, u.employee_name, u.username, u.pw, u.gender, u.date_of_birth, u.address, u.branch, u.bank_name, u.account_no, u.ifsc_code, u.pan_no, u.salary, u.contact_01, u.contact_02, u.email_id, u.forvendorid, u.shearing, u.date_joining, u.added_date, u.updated_date, u.actv, u.User_for, u.signature, u.is_android, u.boq_rate, u.company_id]);
        } catch (e: any) {
          console.error("User insert error:", e.message);
        }
      }
    }

    const companies = await allQuery('SELECT * FROM ks_companies');
    if (companies && companies.length > 0) {
      for (const c of companies) {
        try {
          await client.query('INSERT INTO ks_companies (id, cnm) VALUES ($1, $2) ON CONFLICT (cnm) DO NOTHING', [c.id, c.cnm]);
        } catch (e: any) {
          console.error("Company insert error:", e.message);
        }
      }
    }

    let sitesCount = 0;
    try {
      const sites = await allQuery('SELECT * FROM ks_sites');
      if (sites && sites.length > 0) {
        for (const s of sites) {
          try {
             await client.query(`
               INSERT INTO ks_sites (id, user_id, company_id, customer_id, site_name, address, dlvry_address, client_mail, contact_person1, contact_person1_mobile, contact_person1_mail, contact_person2, contact_person2_mobile, contact_person2_mail, actv, boq_amount, pmc, from_date, end_date, HOD, fl, company_logo, PMC_logo, our_logo, graph, max_permissible_indents, boq_added, sft, purchase_sft, internal, ongoing, sft_block, feedback)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
               ON CONFLICT (id) DO NOTHING
             `, [s.id, s.user_id, s.company_id, s.customer_id, s.site_name, s.address, s.dlvry_address, s.client_mail, s.contact_person1, s.contact_person1_mobile, s.contact_person1_mail, s.contact_person2, s.contact_person2_mobile, s.contact_person2_mail, s.actv, s.boq_amount, s.pmc, s.from_date, s.end_date, s.HOD, s.fl, s.company_logo, s.PMC_logo, s.our_logo, s.graph, s.max_permissible_indents, s.boq_added, s.sft, s.purchase_sft, s.internal, s.ongoing, s.sft_block, s.feedback]);
             sitesCount++;
          } catch(e: any) {}
        }
      }
    } catch (e: any) {
      console.log("No ks_sites in SQLite");
    }

    await client.end();
    return NextResponse.json({ 
      success: true, 
      message: 'Migration to Postgres completed successfully!',
      stats: {
        usersMigrated: users?.length || 0,
        companiesMigrated: companies?.length || 0,
        sitesMigrated: sitesCount
      }
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
