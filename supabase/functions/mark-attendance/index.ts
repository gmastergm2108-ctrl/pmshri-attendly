import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WHATSAPP_SERVICE_URL = Deno.env.get('WHATSAPP_SERVICE_URL') || 'http://localhost:3000/send-message';

interface MarkAttendanceRequest {
  admin_no: string;
  status: 'PRESENT' | 'ABSENT';
}

interface Student {
  id: string;
  admin_no: string;
  name: string;
  parent_phone: string;
}

async function sendWhatsAppMessage(number: string, message: string): Promise<boolean> {
  try {
    console.log(`Sending WhatsApp message to ${number}...`);
    
    const response = await fetch(WHATSAPP_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number,
        message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`WhatsApp API error: ${response.status} - ${errorText}`);
      return false;
    }

    console.log('WhatsApp message sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { admin_no, status }: MarkAttendanceRequest = await req.json();

    // Validate input
    if (!admin_no || !status) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: admin_no and status are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!['PRESENT', 'ABSENT'].includes(status)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid status. Must be PRESENT or ABSENT' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing attendance for admin_no: ${admin_no}, status: ${status}`);

    // Look up student by admin_no
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, admin_no, name, parent_phone')
      .eq('admin_no', admin_no)
      .single();

    if (studentError || !student) {
      console.error('Student not found:', studentError);
      return new Response(
        JSON.stringify({ 
          error: `Student with admin_no ${admin_no} not found` 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found student: ${student.name}`);

    // Insert attendance record
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .insert({
        student_id: student.id,
        status: status.toLowerCase(),
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (attendanceError) {
      console.error('Error inserting attendance:', attendanceError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to mark attendance',
          details: attendanceError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Attendance marked successfully:', attendance);

    // Send WhatsApp message to parent
    let whatsappSent = false;
    if (student.parent_phone) {
      const message = `Your child ${student.name} is ${status} today.`;
      whatsappSent = await sendWhatsAppMessage(student.parent_phone, message);
    } else {
      console.warn('No parent phone number found for student');
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Attendance marked successfully',
        data: {
          student_name: student.name,
          admin_no: student.admin_no,
          status,
          timestamp: attendance.timestamp,
          whatsapp_sent: whatsappSent,
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
