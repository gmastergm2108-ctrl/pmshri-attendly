import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Fingerprint, Clock, User, Shield } from "lucide-react";
import Navigation from "@/components/Navigation";

interface FingerLoginLog {
  id: string;
  fingerprint_id: number;
  user_id: string | null;
  device_id: string | null;
  login_time: string;
  users: {
    name: string;
    role: string;
    class: string | null;
    section: string | null;
  } | null;
}

const getRoleBadgeVariant = (role: string | undefined) => {
  switch (role) {
    case 'admin':
      return 'destructive';
    case 'teacher':
      return 'default';
    case 'student':
      return 'secondary';
    default:
      return 'outline';
  }
};

const FingerLogin = () => {
  const [logs, setLogs] = useState<FingerLoginLog[]>([]);
  const [lastLogin, setLastLogin] = useState<FingerLoginLog | null>(null);

  useEffect(() => {
    // Fetch initial logs
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('finger_login_logs')
        .select(`
          *,
          users (
            name,
            role,
            class,
            section
          )
        `)
        .order('login_time', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching logs:', error);
        return;
      }

      if (data && data.length > 0) {
        setLogs(data);
        setLastLogin(data[0]);
      }
    };

    fetchLogs();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('finger-login-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'finger_login_logs'
        },
        async (payload) => {
          console.log('New login detected:', payload);
          
          // Fetch the complete log with user info
          const { data: newLog } = await supabase
            .from('finger_login_logs')
            .select(`
              *,
              users (
                name,
                role,
                class,
                section
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (newLog) {
            setLogs(prev => [newLog, ...prev].slice(0, 50));
            setLastLogin(newLog);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto pt-20 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Fingerprint className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Fingerprint Login Monitor</h1>
        </div>

        {/* Last Login Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Last Finger Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastLogin ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold">
                        {lastLogin.users?.name || 'Unknown User'}
                      </h2>
                      {lastLogin.users?.role && (
                        <Badge variant={getRoleBadgeVariant(lastLogin.users.role)}>
                          {lastLogin.users.role.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    {lastLogin.users?.class && (
                      <p className="text-muted-foreground">
                        Class: {lastLogin.users.class} {lastLogin.users.section || ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Fingerprint className="h-4 w-4" />
                      <span className="text-lg font-mono">ID: {lastLogin.fingerprint_id}</span>
                    </div>
                    {lastLogin.device_id && (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                        <Shield className="h-3 w-3" />
                        <span>{lastLogin.device_id}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{format(new Date(lastLogin.login_time), 'PPpp')}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No login activity yet</p>
            )}
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Login Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Class/Section</TableHead>
                    <TableHead>Fingerprint ID</TableHead>
                    <TableHead>Device</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No login activity yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.login_time), 'HH:mm:ss')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.users?.name || (
                            <span className="text-muted-foreground italic">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.users?.role ? (
                            <Badge variant={getRoleBadgeVariant(log.users.role)}>
                              {log.users.role}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.users?.class ? (
                            `${log.users.class} ${log.users.section || ''}`
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">
                          {log.fingerprint_id}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.device_id || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FingerLogin;