import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get total count
    const { count: totalRecords } = await supabase
      .from('equities_data')
      .select('*', { count: 'exact', head: true })

    // Get new entries stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const { count: todayCount } = await supabase
      .from('equities_data')
      .select('*', { count: 'exact', head: true })
      .gte('BROADCAST_DATE_TIME', today.toISOString())

    const { count: weekCount } = await supabase
      .from('equities_data')
      .select('*', { count: 'exact', head: true })
      .gte('BROADCAST_DATE_TIME', weekAgo.toISOString())

    // Get latest record timestamp
    const { data: latestRecord } = await supabase
      .from('equities_data')
      .select('BROADCAST_DATE_TIME')
      .order('BROADCAST_DATE_TIME', { ascending: false })
      .limit(1)

    const stats = {
      totalRecords: totalRecords || 0,
      newEntriesToday: todayCount || 0,
      newEntriesThisWeek: weekCount || 0,
      lastUpdated: latestRecord?.[0]?.BROADCAST_DATE_TIME || null,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 