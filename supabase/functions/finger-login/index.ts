import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fingerprint_id, device_id } = await req.json();

    // Validate fingerprint_id
    if (!fingerprint_id && fingerprint_id !== 0) {
      return new Response(
        JSON.stringify({ error: 'fingerprint_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate it's a number
    const fingerprintNum = parseInt(fingerprint_id);
    if (isNaN(fingerprintNum)) {
      return new Response(
        JSON.stringify({ error: 'fingerprint_id must be a number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Looking up fingerprint ID: ${fingerprintNum}`);

    // Look up user by fingerprint_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, role, class, section, fingerprint_id')
      .eq('fingerprint_id', fingerprintNum)
      .maybeSingle();

    if (userError) {
      console.error('Error looking up user:', userError);
    }

    const loginTime = new Date().toISOString();

    // Insert login log
    const { error: logError } = await supabase
      .from('finger_login_logs')
      .insert({
        fingerprint_id: fingerprintNum,
        user_id: user?.id || null,
        device_id: device_id || null,
        login_time: loginTime
      });

    if (logError) {
      console.error('Error inserting log:', logError);
      return new Response(
        JSON.stringify({ error: 'Failed to log fingerprint' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If user found, return success with user info
    if (user) {
      console.log(`User found: ${user.name} (${user.role})`);
      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
            class: user.class,
            section: user.section
          },
          fingerprint_id: fingerprintNum,
          logged_in_at: loginTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // User not found
    console.log(`Unknown fingerprint: ${fingerprintNum}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unknown fingerprint',
        fingerprint_id: fingerprintNum,
        logged_in_at: loginTime
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});