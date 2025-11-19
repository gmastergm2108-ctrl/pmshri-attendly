import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface AttendanceRecord {
  id: string;
  student_id: string;
  status: 'present' | 'late' | 'absent';
  timestamp: string;
  device_id: string | null;
  students: {
    name: string;
    roll_number: string;
    class: string;
    section: string;
  };
}

const Attendance = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('attendance-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
        },
        () => {
          fetchAttendance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(
          `
          id,
          student_id,
          status,
          timestamp,
          device_id,
          students (
            name,
            roll_number,
            class,
            section
          )
        `
        )
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setRecords(data as AttendanceRecord[] || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      present: 'default',
      late: 'secondary',
      absent: 'destructive',
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Real-Time Attendance</h1>
        <p className="text-muted-foreground">Live attendance tracking</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No attendance records yet</p>
            </div>
          ) : (
            <>
              {/* Desktop view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 text-left font-medium">Roll Number</th>
                      <th className="py-3 text-left font-medium">Student Name</th>
                      <th className="py-3 text-left font-medium">Class</th>
                      <th className="py-3 text-left font-medium">Status</th>
                      <th className="py-3 text-left font-medium">Time</th>
                      <th className="py-3 text-left font-medium">Device</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id} className="border-b hover:bg-muted/50">
                        <td className="py-4">{record.students.roll_number}</td>
                        <td className="py-4">{record.students.name}</td>
                        <td className="py-4">
                          {record.students.class}-{record.students.section}
                        </td>
                        <td className="py-4">{getStatusBadge(record.status)}</td>
                        <td className="py-4">
                          {format(new Date(record.timestamp), 'MMM dd, yyyy HH:mm')}
                        </td>
                        <td className="py-4 text-muted-foreground">
                          {record.device_id || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile view */}
              <div className="space-y-4 md:hidden">
                {records.map((record) => (
                  <div key={record.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{record.students.name}</span>
                      {getStatusBadge(record.status)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Roll: {record.students.roll_number}</p>
                      <p>
                        Class: {record.students.class}-{record.students.section}
                      </p>
                      <p>{format(new Date(record.timestamp), 'MMM dd, yyyy HH:mm')}</p>
                      {record.device_id && <p>Device: {record.device_id}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Attendance;