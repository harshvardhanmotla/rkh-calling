export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { customer_id, agent_id } = req.body;
  if (!customer_id || !agent_id) {
    return res.status(400).json({ success: false, error: 'Missing customer_id or agent_id' });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    return res.status(500).json({ success: false, error: 'Server misconfigured' });
  }
  try {
    // Step 1: Get customer phone number
    const custResponse = await fetch(
      `${supabaseUrl}/rest/v1/customers?id=eq.${customer_id}&select=phone`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
    const customers = await custResponse.json();
    console.log('Customer lookup:', JSON.stringify(customers));
    if (!customers || customers.length === 0 || !customers[0].phone) {
      return res.status(404).json({ success: false, error: 'Customer not found or no phone' });
    }

    // Step 2: Get agent C2C key from Supabase
    const agentResponse = await fetch(
      `${supabaseUrl}/rest/v1/agents?id=eq.${agent_id}&select=c2c_key`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
    const agents = await agentResponse.json();
    console.log('Agent lookup:', JSON.stringify(agents));
    if (!agents || agents.length === 0 || !agents[0].c2c_key) {
      return res.status(404).json({ success: false, error: 'Agent not found or no C2C key' });
    }

    const customerPhone = customers[0].phone.toString().replace(/^(\+?91)?/, '91');

    // Step 3: Call Smartflo Click to Call Support API
    const smartfloPayload = {
      customer_number: customerPhone,
      api_key: agents[0].c2c_key,
      caller_id: '918065068760',
      async: 1,
    };
    console.log('Smartflo payload:', JSON.stringify(smartfloPayload));

    const smartfloResponse = await fetch(
      'https://api-smartflo.tatateleservices.com/v1/click_to_call_support',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(smartfloPayload),
      }
    );
    const smartfloData = await smartfloResponse.json();
    console.log('Smartflo response:', smartfloResponse.status, JSON.stringify(smartfloData));

    return res.status(smartfloResponse.status).json(smartfloData);
  } catch (error) {
    console.error('Call failed:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
