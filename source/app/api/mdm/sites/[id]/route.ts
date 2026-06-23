import { NextResponse } from 'next/server';
import { runQuery, getQuery } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await request.json();
    const {
      user_id, company_id, customer_id, site_name, address, dlvry_address, client_mail,
      contact_person1, contact_person1_mobile, contact_person1_mail, contact_person2,
      contact_person2_mobile, contact_person2_mail, actv, boq_amount, pmc, from_date,
      end_date, HOD, fl, company_logo, PMC_logo, our_logo, graph, max_permissible_indents,
      boq_added, sft, purchase_sft, internal, ongoing, sft_block, feedback, device_id
    } = body;
    
    if (!company_id || !customer_id || !site_name) {
      return NextResponse.json({ error: 'Company ID, Customer ID, and Site Name are required' }, { status: 400 });
    }
    
    const siteExists = await getQuery(`SELECT id FROM ks_sites WHERE id = ?`, [id]);
    if (!siteExists) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }
    
    await runQuery(
      `UPDATE ks_sites SET 
        user_id = ?, company_id = ?, customer_id = ?, site_name = ?, address = ?, dlvry_address = ?, client_mail = ?,
        contact_person1 = ?, contact_person1_mobile = ?, contact_person1_mail = ?, contact_person2 = ?,
        contact_person2_mobile = ?, contact_person2_mail = ?, actv = ?, boq_amount = ?, pmc = ?, from_date = ?,
        end_date = ?, HOD = ?, fl = ?, company_logo = ?, PMC_logo = ?, our_logo = ?, graph = ?, max_permissible_indents = ?,
        boq_added = ?, sft = ?, purchase_sft = ?, internal = ?, ongoing = ?, sft_block = ?, feedback = ?, device_id = ?,
        udate = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        user_id || null, company_id, customer_id, site_name, address || null, dlvry_address || null, client_mail || null,
        contact_person1 || null, contact_person1_mobile || null, contact_person1_mail || null, contact_person2 || null,
        contact_person2_mobile || null, contact_person2_mail || null, actv || null, boq_amount || '0.00', pmc || '0', from_date || null,
        end_date || null, HOD || null, fl || null, company_logo || null, PMC_logo || null, our_logo || null, graph || null, max_permissible_indents || null,
        boq_added || null, sft || null, purchase_sft || null, internal || null, ongoing || 'Y', sft_block || null, feedback || null, device_id || '0', id
      ]
    );
    
    return NextResponse.json({ success: true, message: 'Site updated successfully' });
  } catch (error) {
    console.error('Error updating site:', error);
    return NextResponse.json({ error: 'Failed to update site' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    
    const siteExists = await getQuery(`SELECT id FROM ks_sites WHERE id = ?`, [id]);
    if (!siteExists) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }
    
    await runQuery(`DELETE FROM ks_sites WHERE id = ?`, [id]);
    
    return NextResponse.json({ success: true, message: 'Site deleted successfully' });
  } catch (error) {
    console.error('Error deleting site:', error);
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 });
  }
}
