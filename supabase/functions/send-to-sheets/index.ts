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
    const webhookUrl = Deno.env.get('GOOGLE_SHEETS_WEBHOOK_URL');
    
    if (!webhookUrl) {
      console.error('GOOGLE_SHEETS_WEBHOOK_URL is not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { reporter_name, damage_description, location, photo_url, created_at } = await req.json();

    console.log('Sending data to Google Sheets:', { reporter_name, damage_description, location, photo_url, created_at });

    // Send data to Google Apps Script webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reporter_name,
        damage_description,
        location,
        photo_url: photo_url || '',
        created_at: created_at || new Date().toISOString(),
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Sheets webhook error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send to Google Sheets', details: errorText }),
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
    console.error('Error in send-to-sheets function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});