import { NextResponse } from 'next/server';
import { runQuery, getQuery } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await request.json();
    const {
      company_id, user_id, opening_bal, cnm, customer_name_on_bill,
      customer_address, mobileno, csd, ced, emails, actv, gst_no
    } = body;
    
    if (!company_id || !cnm) {
      return NextResponse.json({ error: 'Company ID and Name (cnm) are required' }, { status: 400 });
    }
    
    const customerExists = await getQuery(`SELECT id FROM ks_customers WHERE id = ?`, [id]);
    if (!customerExists) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    
    await runQuery(
      `UPDATE ks_customers SET 
        company_id = ?, user_id = ?, opening_bal = ?, cnm = ?, customer_name_on_bill = ?,
        customer_address = ?, mobileno = ?, csd = ?, ced = ?, emails = ?, actv = ?, gst_no = ?
      WHERE id = ?`,
      [
        company_id, user_id || null, opening_bal || null, cnm, customer_name_on_bill || null,
        customer_address || null, mobileno || null, csd || null, ced || null, emails || null, actv || null, gst_no || null, id
      ]
    );
    
    return NextResponse.json({ success: true, message: 'Customer updated successfully' });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    
    const customerExists = await getQuery(`SELECT id FROM ks_customers WHERE id = ?`, [id]);
    if (!customerExists) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    
    await runQuery(`DELETE FROM ks_customers WHERE id = ?`, [id]);
    
    return NextResponse.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
