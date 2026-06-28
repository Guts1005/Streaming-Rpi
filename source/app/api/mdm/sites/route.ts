import { NextResponse } from 'next/server';
import { runQuery, allQuery, getQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const companyId = searchParams.get('company_id');
    const customerId = searchParams.get('customer_id');
    
    let sql = `
      SELECT s.*, comp.cnm as company_name, cust.cnm as customer_name
      FROM ks_sites s
      LEFT JOIN ks_companies comp ON s.company_id = comp.id
      LEFT JOIN ks_customers cust ON s.customer_id = cust.id
      WHERE 1=1
    `;
    let params: any[] = [];
    
    if (companyId) {
      sql += ` AND s.company_id = ?`;
      params.push(companyId);
    }

    if (customerId) {
      sql += ` AND s.customer_id = ?`;
      params.push(customerId);
    }
    
    if (search) {
      sql += ` AND (s.site_name LIKE ? OR s.address LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    sql += ` ORDER BY s.tdate DESC`;
    
    const sites = await allQuery(sql, params);
    return NextResponse.json({ success: true, data: sites });
  } catch (error) {
    console.error('Error fetching sites:', error);
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
    
    const result = await getQuery(
      `INSERT INTO ks_sites (
        user_id, company_id, customer_id, site_name, address, dlvry_address, client_mail,
        contact_person1, contact_person1_mobile, contact_person1_mail, contact_person2,
        contact_person2_mobile, contact_person2_mail, actv, boq_amount, pmc, from_date,
        end_date, HOD, fl, company_logo, PMC_logo, our_logo, graph, max_permissible_indents,
        boq_added, sft, purchase_sft, internal, ongoing, sft_block, feedback, tdate, udate
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING id`,
      [
        user_id || null, company_id, customer_id, site_name, address || null, dlvry_address || null, client_mail || null,
        contact_person1 || null, contact_person1_mobile || null, contact_person1_mail || null, contact_person2 || null,
        contact_person2_mobile || null, contact_person2_mail || null, actv || null, boq_amount || '0.00', pmc || '0', from_date || null,
        end_date || null, HOD || null, fl || null, company_logo || null, PMC_logo || null, our_logo || null, graph || null, max_permissible_indents || null,
        boq_added || null, sft || null, purchase_sft || null, internal || null, ongoing || 'Y', sft_block || null, feedback || null
      ]
    );
    
    const newSiteId = (result as any)?.id;
    if (newSiteId && device_id && device_id !== '0' && device_id !== '') {
      await runQuery('UPDATE ks_devices SET site_id = ? WHERE id = ?', [newSiteId, device_id]);
    }
    
    return NextResponse.json({ success: true, id: newSiteId || null, message: 'Site created successfully' });
  } catch (error) {
    console.error('Error creating site:', error);
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
  }
}
