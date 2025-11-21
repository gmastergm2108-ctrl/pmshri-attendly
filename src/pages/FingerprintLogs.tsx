import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

interface AttendanceLog {
  id: string;
  fingerprint_id: number;
  created_at: string;
}

export default function FingerprintLogs() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [lastScanned, setLastScanned] = useState<AttendanceLog | null>(null);

  useEffect(() => {
    // Initial fetch
    fetchLogs();

    // Set up realtime subscription
    const channel = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance'
        },
        (payload) => {
          const newLog = payload.new as AttendanceLog;
          setLogs((prev) => [newLog, ...prev]);
          setLastScanned(newLog);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setLogs(data);
      if (data.length > 0) {
        setLastScanned(data[0]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Live Fingerprint Logs
          </h1>
          <p className="text-muted-foreground">
            Real-time fingerprint scanning system
          </p>
        </div>

        {/* Last Scanned Card */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Last Scanned</CardTitle>
          </CardHeader>
          <CardContent>
            {lastScanned ? (
              <div className="text-center">
                <div className="text-6xl font-bold text-primary mb-4">
                  {lastScanned.fingerprint_id}
                </div>
                <div className="text-muted-foreground">
                  {format(new Date(lastScanned.created_at), 'PPpp')}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Waiting for fingerprint scan...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Fingerprint Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">
                      Fingerprint ID
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-center py-8 text-muted-foreground">
                        No fingerprint scans yet
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-accent transition-colors">
                        <td className="py-3 px-4 font-mono text-lg font-semibold text-primary">
                          {log.fingerprint_id}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {format(new Date(log.created_at), 'PPpp')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
