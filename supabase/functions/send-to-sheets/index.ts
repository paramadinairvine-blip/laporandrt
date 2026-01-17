import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This is a public endpoint for damage report submissions
    // Authentication is not required because:
    // 1. The data being sent is already public (visible on /reports page)
    // 2. Inputs are validated and sanitized below
    // 3. Public report submission is an intentional feature
    console.log('Processing public damage report submission to Google Sheets');

    const webhookUrl = Deno.env.get('GOOGLE_SHEETS_WEBHOOK_URL');
    
    if (!webhookUrl) {
      console.error('GOOGLE_SHEETS_WEBHOOK_URL is not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    
    // Validate required fields
    const { reporter_name, damage_description, location, damage_type, photo_url, created_at } = body;
    
    if (!reporter_name || typeof reporter_name !== 'string' || reporter_name.trim().length === 0) {
      console.error('Invalid reporter_name received');
      return new Response(
        JSON.stringify({ error: 'Invalid reporter_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!damage_description || typeof damage_description !== 'string' || damage_description.trim().length === 0) {
      console.error('Invalid damage_description received');
      return new Response(
        JSON.stringify({ error: 'Invalid damage_description' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!location || typeof location !== 'string') {
      console.error('Invalid location received');
      return new Response(
        JSON.stringify({ error: 'Invalid location' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate damage_type against allowed enum values
    const allowedDamageTypes = ['rehab', 'listrik', 'air', 'taman', 'lainnya'];
    const validDamageType = damage_type && allowedDamageTypes.includes(damage_type) 
      ? damage_type 
      : 'lainnya';

    // Sanitize inputs to prevent injection and limit lengths
    const sanitizedData = {
      reporter_name: reporter_name.trim().substring(0, 200),
      damage_description: damage_description.trim().substring(0, 2000),
      location: location.trim().substring(0, 100),
      damage_type: validDamageType,
      photo_url: photo_url ? String(photo_url).substring(0, 500) : '',
      created_at: created_at || new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };

    console.log('Sending sanitized data to Google Sheets:', {
      reporter_name: sanitizedData.reporter_name,
      location: sanitizedData.location,
      damage_type: sanitizedData.damage_type,
      has_photo: !!sanitizedData.photo_url,
      timestamp: sanitizedData.timestamp,
    });

    // Send data to Google Apps Script webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sanitizedData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Sheets webhook error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send to Google Sheets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.text();
    console.log('Google Sheets response:', result);

    return new Response(
      JSON.stringify({ success: true, message: 'Data sent to Google Sheets' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-to-sheets function:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
