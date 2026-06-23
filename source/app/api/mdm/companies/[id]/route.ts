import { NextResponse } from 'next/server';
import { runQuery, getQuery } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const body = await request.json();
    const {
      cnm, company_name_on_bill, company_address, csd, ced,
      opening_bal, phone, phone2, SMS, gst_number, registration_no,
      service_tax_no, tin_no, cst_no, emails, voucher_adjust_date
    } = body;
    
    if (!cnm) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }
    
    const companyExists = await getQuery(`SELECT id FROM ks_companies WHERE id = ?`, [id]);
    if (!companyExists) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    
    await runQuery(
      `UPDATE ks_companies SET 
        cnm = ?, company_name_on_bill = ?, company_address = ?, csd = ?, ced = ?,
        opening_bal = ?, phone = ?, phone2 = ?, SMS = ?, gst_number = ?, registration_no = ?,
        service_tax_no = ?, tin_no = ?, cst_no = ?, emails = ?, voucher_adjust_date = ?
      WHERE id = ?`,
      [
        cnm, company_name_on_bill || null, company_address || null, csd || null, ced || null,
        opening_bal || null, phone || null, phone2 || null, SMS || null, gst_number || null, registration_no || null,
        service_tax_no || null, tin_no || null, cst_no || null, emails || null, voucher_adjust_date || null, id
      ]
    );
    
    return NextResponse.json({ success: true, message: 'Company updated successfully' });
  } catch (error) {
    console.error('Error updating company:', error);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    
    const companyExists = await getQuery(`SELECT id FROM ks_companies WHERE id = ?`, [id]);
    if (!companyExists) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    
    await runQuery(`DELETE FROM ks_companies WHERE id = ?`, [id]);
    
    return NextResponse.json({ success: true, message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    return NextResponse.json({ error: 'Failed to delete company' }, { status: 500 });
  }
}
