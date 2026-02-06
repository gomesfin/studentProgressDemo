import { supabase } from './src/supabaseClient.js';

async function verifyWrite() {
    console.log("--- Testing Write Permissions ---");

    // 1. Try to create a subject
    const { error: sError } = await supabase.from('subjects').upsert({ id: 'test', name: 'Test Subject', color: '#000000' });
    if (sError) console.error("Error writing to subjects:", sError);
    else console.log("Success: Wrote to subjects table.");

    // 2. Try to create a class
    const { data: cls, error: cError } = await supabase
        .from('classes')
        .insert({ title: 'Test Class', subject_id: 'test' })
        .select()
        .single();

    if (cError) {
        console.error("Error writing to classes:", cError);
    } else {
        console.log("Success: Wrote to classes table. ID:", cls.id);
        // Cleanup
        await supabase.from('classes').delete().eq('id', cls.id);
    }

    // Cleanup Subject
    await supabase.from('subjects').delete().eq('id', 'test');

    console.log("--- Write Test Complete ---");
}

verifyWrite();
