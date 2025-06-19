import { supabase } from '../../../lib/supabase'

export async function GET(request) {
  const { data: logs, error } = await supabase
    .from('download_logs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }

  return Response.json({ logs: logs || [] });
}
