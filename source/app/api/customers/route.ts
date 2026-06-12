import { NextRequest, NextResponse } from 'next/server';
import { allQuery, runQuery } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user: any = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 10;
  const offset = (page - 1) * limit;

  try {
    const customers = await allQuery(
      `SELECT * FROM customers 
       WHERE company_name LIKE ? OR customer_name LIKE ? OR device_id LIKE ?
       ORDER BY created_date DESC LIMIT ? OFFSET ?`,
      [`%${search}%`, `%${search}%`, `%${search}%`, limit, offset]
    );

    const totalRes: any = await allQuery(
      `SELECT COUNT(*) as count FROM customers 
       WHERE company_name LIKE ? OR customer_name LIKE ? OR device_id LIKE ?`,
      [`%${search}%`, `%${search}%`, `%${search}%`]
    );
    const total = totalRes[0].count;

    return NextResponse.json({ customers, total, page, limit });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user: any = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const { customer_id, customer_name, company_name, mobile_number, email, address, city, state, country, device_id } = data;

    await runQuery(
      `INSERT INTO customers (customer_id, customer_name, company_name, mobile_number, email, address, city, state, country, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer_id, customer_name, company_name, mobile_number, email, address, city, state, country, device_id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Customer ID already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
