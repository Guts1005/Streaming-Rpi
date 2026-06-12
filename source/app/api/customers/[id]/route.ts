import { NextRequest, NextResponse } from 'next/server';
import { runQuery, getQuery } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

type Context = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: Context) {
  const user: any = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await context.params;
    const data = await req.json();
    const { customer_name, company_name, mobile_number, email, address, city, state, country, device_id, status } = data;

    await runQuery(
      `UPDATE customers SET 
        customer_name = ?, company_name = ?, mobile_number = ?, email = ?, 
        address = ?, city = ?, state = ?, country = ?, device_id = ?, status = ?, updated_date = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [customer_name, company_name, mobile_number, email, address, city, state, country, device_id, status, id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  const user: any = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await context.params;
    await runQuery('DELETE FROM customers WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
