import { NextResponse } from 'next/server';
import { runQuery, allQuery } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    
    let sql = `SELECT * FROM ks_companies ORDER BY tdate DESC`;
    let params: any[] = [];
    
    if (search) {
      sql = `SELECT * FROM ks_companies WHERE cnm LIKE ? OR emails LIKE ? ORDER BY tdate DESC`;
      params = [`%${search}%`, `%${search}%`];
    }
    
    const companies = await allQuery(sql, params);
    return NextResponse.json({ success: true, data: companies });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      cnm, company_name_on_bill, company_address, csd, ced,
      opening_bal, phone, phone2, SMS, gst_number, registration_no,
      service_tax_no, tin_no, cst_no, emails, voucher_adjust_date
    } = body;
    
    if (!cnm) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }
    
    const result = await runQuery(
      `INSERT INTO ks_companies (
        cnm, company_name_on_bill, company_address, csd, ced,
        opening_bal, phone, phone2, SMS, gst_number, registration_no,
        service_tax_no, tin_no, cst_no, emails, voucher_adjust_date, tdate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        cnm, company_name_on_bill || null, company_address || null, csd || null, ced || null,
        opening_bal || null, phone || null, phone2 || null, SMS || null, gst_number || null, registration_no || null,
        service_tax_no || null, tin_no || null, cst_no || null, emails || null, voucher_adjust_date || null
      ]
    );
    
    return NextResponse.json({ success: true, id: typeof result === 'object' && result ? (result as any).id : null, message: 'Company created successfully' });
  } catch (error) {
    console.error('Error creating company:', error);
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
  }
}
