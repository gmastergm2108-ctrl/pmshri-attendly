import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Stats {
  totalStudents: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
}

interface AttendanceLog {
  id: string;
  student_id: string;
  status: string;
  timestamp: string;
  students: {
    name: string;
    roll_number: string;
  };
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
  });
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    
    // Subscribe to real-time attendance updates
    const channel = supabase
      .channel('attendance-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Get total students
      const { count: totalCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      // Get today's attendance stats
      const today = new Date().toISOString().split('T')[0];
      
      const { data: todayAttendance } = await supabase
        .from('attendance')
        .select('status')
        .gte('timestamp', `${today}T00:00:00`)
        .lte('timestamp', `${today}T23:59:59`);

      const presentCount = todayAttendance?.filter((a) => a.status === 'present').length || 0;
      const lateCount = todayAttendance?.filter((a) => a.status === 'late').length || 0;
      const absentCount = todayAttendance?.filter((a) => a.status === 'absent').length || 0;

      // Get recent attendance logs
      const { data: logs } = await supabase
        .from('attendance')
        .select(`
          id,
          student_id,
          status,
          timestamp,
          students (
            name,
            roll_number
          )
        `)
        .order('timestamp', { ascending: false })
        .limit(10);

      setStats({
        totalStudents: totalCount || 0,
        presentToday: presentCount,
        lateToday: lateCount,
        absentToday: absentCount,
      });

      setRecentLogs(logs as AttendanceLog[] || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const statCards = [
    { title: 'Total Students', value: stats.totalStudents, icon: Users, color: 'text-primary' },
    { title: 'Present Today', value: stats.presentToday, icon: CheckCircle, color: 'text-success' },
    { title: 'Late Today', value: stats.lateToday, icon: Clock, color: 'text-warning' },
    { title: 'Absent Today', value: stats.absentToday, icon: XCircle, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to the attendance management system</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-center text-muted-foreground">No attendance records yet</p>
          ) : (
            <div className="space-y-4">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        log.status === 'present'
                          ? 'bg-success'
                          : log.status === 'late'
                          ? 'bg-warning'
                          : 'bg-destructive'
                      }`}
                    />
                    <div>
                      <p className="font-medium">{log.students.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Roll: {log.students.roll_number}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium capitalize">{log.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.timestamp), 'MMM dd, HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;