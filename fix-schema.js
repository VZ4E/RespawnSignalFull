const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ehkvtwvtmvgtkqqotujo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoa3Z0d3Z0bXZndGtxcW90dWpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU2MTM4OSwiZXhwIjoyMDg5MTM3Mzg5fQ.jt4r9IKKl0FwbP32njAGmOFXxGyV03HeW30b7l5u-Qo'
);

(async () => {
  try {
    console.log('1. Checking current schema...');
    const { data: sample } = await supabase.from('scans').select('*').limit(1);
    const columns = sample?.length > 0 ? Object.keys(sample[0]) : [];
    console.log('Current columns:', columns);
    console.log('Has videos column:', columns.includes('videos'));

    if (!columns.includes('videos')) {
      console.log('\n2. Testing insert with videos column (this will auto-create the column)...');
      
      // Just try inserting — if the column doesn't exist, Supabase should auto-create it
      // Or the error will tell us what's wrong
      const testId = Math.random().toString(36).slice(2);
      const { data: inserted, error: insertErr } = await supabase.from('scans').insert({
        user_id: testId,
        username: 'test-fix-' + Date.now(),
        range: 1,
        video_count: 0,
        credits_used: 0,
        deals: [],
        videos: { test: 'data' }
      });
      
      if (insertErr) {
        console.error('❌ Insert failed:', insertErr);
        console.error('Message:', insertErr.message);
        console.error('Code:', insertErr.code);
        
        // If it's a column not found, we need to add it manually
        if (insertErr.message && insertErr.message.includes('videos')) {
          console.log('\n3. Attempting manual column creation via SQL...');
          // We'll need to go to Supabase dashboard and run:
          // ALTER TABLE scans ADD COLUMN videos JSONB DEFAULT '[]';
          console.log('Please run this SQL in your Supabase dashboard:');
          console.log('ALTER TABLE scans ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT \'[]\';');
        }
      } else {
        console.log('✅ Insert with videos succeeded!');
        console.log('The videos column was successfully added/used.');
        
        // Verify
        const { data: recheck } = await supabase.from('scans').select('*').limit(1);
        const finalColumns = recheck?.length > 0 ? Object.keys(recheck[0]) : [];
        console.log('Final columns:', finalColumns);
        console.log('Has videos now:', finalColumns.includes('videos'));
      }
    } else {
      console.log('✅ videos column already exists');
    }
  } catch(e) {
    console.error('Exception:', e.message);
  }
})();
