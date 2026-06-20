export default async function handler(req, res) {
  // CORS headers for the frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customer_id, agent_number } = req.body;

  if (!customer_id || !agent_number) {
    return res.status(400).json({ success: false, error: 'Missing customer_id or agent_number' });
  }

  try {
    // Step 1: Get customer phone number from Supabase using service role key
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    const supabaseResponse = await fetch(
      `${supabaseUrl}/rest/v1/customers?id=eq.${customer_id}&select=phone`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );

    const customers = await supabaseResponse.json();

    if (!customers || customers.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const customerPhone = customers[0].phone;

    if (!customerPhone) {
      return res.status(400).json({ success: false, error: 'Customer has no phone number' });
    }

    // Step 2: Call Smartflo click-to-call API
    // Format: try 10-digit first. If calls fail, switch to 91-prefix below.
    const formattedAgentNumber = agent_number.replace(/^91/, '');
    const formattedCustomerPhone = customerPhone.replace(/^91/, '');

    const smartfloResponse = await fetch(
      'https://api-smartflo.tatateleservices.com/v1/click_to_call',
      {
        method: 'POST',
        headers: {
          'Authorization': process.env.SMARTFLO_API_TOKEN,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          agent_number: formattedAgentNumber,
          destination_number: formattedCustomerPhone,
          caller_id: formattedAgentNumber,
          async: 1,
        }),
      }
    );

    const smartfloData = await smartfloResponse.json();

    // Log everything so you can debug in Vercel logs
    console.log('Smartflo request:', {
      agent_number: formattedAgentNumber,
      destination_number: formattedCustomerPhone,
      caller_id: formattedAgentNumber,
      async: 1,
    });
    console.log('Smartflo response status:', smartfloResponse.status);
    console.log('Smartflo response body:', JSON.stringify(smartfloData));

    // Return exactly what Smartflo said, so the frontend can show the real status
    return res.status(smartfloResponse.status).json(smartfloData);

  } catch (error) {
    console.error('Call failed:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
