import { NextResponse } from 'next/server';
import { runQuery, allQuery } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const companyId = searchParams.get('company_id');
    
    let sql = `
      SELECT c.*, comp.cnm as company_name 
      FROM ks_customers c
      LEFT JOIN ks_companies comp ON c.company_id = comp.id
      WHERE 1=1
    `;
    let params: any[] = [];
    
    if (companyId) {
      sql += ` AND c.company_id = ?`;
      params.push(companyId);
    }
    
    if (search) {
      sql += ` AND (c.cnm LIKE ? OR c.emails LIKE ? OR c.mobileno LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    sql += ` ORDER BY c.tdate DESC`;
    
    const customers = await allQuery(sql, params);
    return NextResponse.json({ success: true, data: customers });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      company_id, user_id, opening_bal, cnm, customer_name_on_bill,
      customer_address, mobileno, csd, ced, emails, actv, gst_no
    } = body;
    
    if (!company_id || !cnm) {
      return NextResponse.json({ error: 'Company ID and Name (cnm) are required' }, { status: 400 });
    }
    
    const result = await runQuery(
      `INSERT INTO ks_customers (
        company_id, user_id, opening_bal, cnm, customer_name_on_bill,
        customer_address, mobileno, csd, ced, emails, actv, gst_no, tdate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        company_id, user_id || null, opening_bal || null, cnm, customer_name_on_bill || null,
        customer_address || null, mobileno || null, csd || null, ced || null, emails || null, actv || null, gst_no || null
      ]
    );
    
    return NextResponse.json({ success: true, id: (result as any)?.id || null, message: 'Customer created successfully' });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}
