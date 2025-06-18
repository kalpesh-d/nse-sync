# NSE Corporate Announcements Dashboard

A modern web dashboard for viewing NSE (National Stock Exchange) corporate announcements data from Supabase.

## Features

- 📊 **Real-time Dashboard**: View total records and last update time
- 🔄 **Data Refresh**: Refresh data from Supabase with one click
- 📋 **Data Table**: Browse recent corporate announcements with search and filtering
- 🎨 **Modern UI**: Clean, responsive design with Tailwind CSS
- 📱 **Responsive**: Works perfectly on desktop and mobile devices

## Setup

### 1. Environment Variables

Create a `.env.local` file in the `nse-app` directory:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Usage

1. **View Dashboard**: The main page shows statistics and recent data
2. **Refresh Data**: Click "Refresh Data" to fetch latest data from Supabase
3. **Browse Data**: View the latest 50 corporate announcements in the table
4. **Monitor Updates**: See when data was last refreshed

## Database Schema

The dashboard connects to a Supabase table named `equities_data` with the following columns:

- `SYMBOL` - Stock symbol
- `COMPANY NAME` - Company name
- `SUBJECT` - Announcement subject
- `DETAILS` - Announcement details
- `BROADCAST DATE/TIME` - Broadcast timestamp
- `RECEIPT` - Receipt ID
- `DISSEMINATION` - Dissemination info
- `DIFFERENCE` - Time difference
- `ATTACHMENT` - Attachment URL
- `FILE SIZE` - File size
- `created_at` - Record creation timestamp

## Technologies Used

- **Next.js 15** - React framework
- **Tailwind CSS** - Styling
- **Supabase** - Database and real-time data
- **Lucide React** - Icons
- **Date-fns** - Date formatting

## Data Source

This dashboard displays data from your Supabase database. The data is populated by your separate NSE sync script that fetches corporate announcements from the NSE API and stores them in the `equities_data` table.
